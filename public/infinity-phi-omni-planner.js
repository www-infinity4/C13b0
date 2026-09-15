(() => {
  'use strict';
  const previousFetch = window.fetch.bind(window);
  const ENDPOINT = 'https://infinity-rogers.marvaseater.workers.dev/v1/chat';
  const STOP = new Set('the a an and or of in on for to from with about what which who how why when where is are was were be been being this that these those tell show find search look give me my please'.split(' '));
  const clean = (value, max = 3200) => String(value || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
  const terms = (value) => [...new Set((clean(value, 600).toLowerCase().match(/[a-z0-9]+/g) || []).filter(word => word.length > 2 && !STOP.has(word)))];
  const timeout = async (promise, ms = 9000) => {
    let timer;
    try {
      return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), ms); })]);
    } finally { clearTimeout(timer); }
  };
  const parseJson = (value) => {
    const raw = String(value || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start < 0 || end <= start) return null;
    try { return JSON.parse(raw.slice(start, end + 1)); } catch { return null; }
  };
  const domain = (value) => { try { return new URL(value).hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; } };

  async function plan(query) {
    const fallback = { canonicalSubject: query, searchQueries: [query], requiredConcepts: terms(query), exactTerms: [], excludedMeanings: [] };
    const prompt = [
      'You are the semantic query planner used by Omni Phi, now serving Infinity Phi.',
      `User query: ${query}`,
      'Keep one exact canonical subject. Infinity Phi is right-and-narrow: every search variant must stay about that subject.',
      'Return 2 to 4 public-web search formulations that expose different evidence sources: original reporting, primary/official material, scholarly or archival material, and useful reference material when appropriate.',
      'Do not turn the query into generic Wikipedia-style encyclopedia headings.',
      'Do not mix homonyms or similarly named people, places, works, products, bands, scientific terms, or events.',
      'requiredConcepts describe what useful evidence should cover. exactTerms are names, dates, numbers, phrases, or identifiers that must not drift. excludedMeanings are competing interpretations to reject.',
      'Return JSON only: {"canonicalSubject":"...","searchQueries":["..."],"requiredConcepts":["..."],"exactTerms":["..."],"excludedMeanings":["..."]}'
    ].join('\n');
    try {
      const response = await timeout(previousFetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ input: prompt, context: { application: 'Infinity Phi', assistant: 'omni-query-planner', task: 'right-narrow-source-planning' } })
      }), 8000);
      if (!response.ok) return fallback;
      const payload = await response.json().catch(() => ({}));
      const parsed = parseJson(payload.output_text || payload.output || payload.answer || '');
      if (!parsed) return fallback;
      const canonicalSubject = clean(parsed.canonicalSubject || query, 220) || query;
      return {
        canonicalSubject,
        searchQueries: [...new Set([query, canonicalSubject, ...(Array.isArray(parsed.searchQueries) ? parsed.searchQueries : [])].map(item => clean(item, 260)).filter(Boolean))].slice(0, 3),
        requiredConcepts: (Array.isArray(parsed.requiredConcepts) ? parsed.requiredConcepts : []).map(v => clean(v, 120)).filter(Boolean).slice(0, 12),
        exactTerms: (Array.isArray(parsed.exactTerms) ? parsed.exactTerms : []).map(v => clean(v, 140)).filter(Boolean).slice(0, 10),
        excludedMeanings: (Array.isArray(parsed.excludedMeanings) ? parsed.excludedMeanings : []).map(v => clean(v, 160)).filter(Boolean).slice(0, 12)
      };
    } catch { return fallback; }
  }

  function score(page, intent) {
    const text = `${clean(page?.title, 300)} ${clean(page?.extract, 4200)}`.toLowerCase();
    const anchors = terms(intent.canonicalSubject);
    const hits = anchors.filter(word => text.includes(word)).length;
    let value = anchors.length ? hits / anchors.length : .4;
    intent.exactTerms.forEach(term => { if (text.includes(String(term).toLowerCase())) value += .2; });
    intent.requiredConcepts.forEach(concept => {
      const words = terms(String(concept));
      if (words.some(word => text.includes(word))) value += .05;
    });
    intent.excludedMeanings.forEach(excluded => { if (text.includes(String(excluded).toLowerCase())) value -= .5; });
    if (page?.thumbnail?.source) value += .03;
    return value;
  }

  function diversify(pages, intent) {
    const ranked = pages.map(page => ({ page, score: score(page, intent) })).sort((a, b) => b.score - a.score);
    const out = [];
    const seen = new Set();
    const domains = new Map();
    for (const item of ranked) {
      const page = item.page;
      const key = `${clean(page?.fullurl, 1200)}|${clean(page?.title, 260)}`.toLowerCase();
      if (!key || seen.has(key)) continue;
      const host = domain(page?.fullurl) || 'unknown';
      const count = domains.get(host) || 0;
      if (host.includes('wikipedia.org') && count >= 1) continue;
      if (count >= 2) continue;
      if (item.score < .08 && out.length >= 6) continue;
      seen.add(key);
      domains.set(host, count + 1);
      out.push(page);
      if (out.length >= 14) break;
    }
    return out;
  }

  async function plannedFetch(input, init) {
    const raw = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input?.url || '';
    let url;
    try { url = new URL(raw, location.href); } catch { return previousFetch(input, init); }
    const isSearch = url.hostname === 'en.wikipedia.org' && url.pathname.endsWith('/w/api.php') && url.searchParams.get('generator') === 'search';
    if (!isSearch || url.searchParams.get('phi_planned') === '1') return previousFetch(input, init);
    const query = clean(url.searchParams.get('gsrsearch') || '', 600);
    if (!query) return previousFetch(input, init);

    const intent = await plan(query);
    const searches = intent.searchQueries.length ? intent.searchQueries : [query];
    const responses = await Promise.allSettled(searches.map(async searchQuery => {
      const next = new URL(url.toString());
      next.searchParams.set('gsrsearch', searchQuery);
      next.searchParams.set('phi_planned', '1');
      const response = await timeout(previousFetch(next, init), 9000);
      if (!response?.ok) return [];
      const data = await response.json().catch(() => ({}));
      return Object.values(data?.query?.pages || {});
    }));
    const pages = responses.flatMap(result => result.status === 'fulfilled' ? result.value : []);
    const chosen = diversify(pages, intent);
    if (!chosen.length) return previousFetch(input, init);
    const payload = { batchcomplete: '', query: { pages: Object.fromEntries(chosen.map((page, index) => [`omni_${index}`, page])) } };
    return new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json; charset=utf-8' } });
  }

  window.fetch = plannedFetch;
  window.InfinityPhiOmniPlanner = { plan, score, diversify };
})();
