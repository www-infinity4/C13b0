(() => {
  'use strict';

  const ENDPOINT = 'https://infinity-rogers.marvaseater.workers.dev/v1/chat';
  const ROUTE_KEY = 'infinity_phi_overview_routes_v1';
  const EVENT_KEY = 'infinity_phi_teacher_events_v1';
  let busy = false;
  let timer = 0;
  let lastSignature = '';

  const clean = (value, max = 5000) => String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);

  function onPhiPage() {
    return /\/phi(?:\/|$)/.test(location.pathname);
  }

  function queryText() {
    try {
      return clean(new URLSearchParams(location.search).get('q') || document.querySelector('.phi-search-box input')?.value || '', 500);
    } catch { return ''; }
  }

  function localDomain(query) {
    const q = clean(query).toLowerCase();
    if (/\b(element|atomic|atom|periodic|isotope|oxidation|compound|chemistry|chemical|electron)\b/.test(q)) return 'chemistry';
    if (/\b(coin|mintage|mint|proof|strike|grade|pcgs|numismatic|auction|denomination)\b/.test(q)) return 'coins';
    if (/\b(software|code|program|app|api|javascript|typescript|python|repository)\b/.test(q)) return 'software';
    if (/\b(film|movie|cinema|television|tv|episode|series|director|actor|actress|cast|screenplay|box office)\b/.test(q)) return 'screen';
    if (/\b(science|scientific|scientist|fringe science|pseudoscience|hypothesis|theory|experiment|physics|biology|astronomy|geology|ecology|neuroscience)\b/.test(q)) return 'science';
    if (/\b(nfl|nba|mlb|nhl|nascar|football|baseball|basketball|hockey|race|score|team|league)\b/.test(q)) return 'sports';
    if (/\b(election|government|president|congress|senate|court|policy|law|governor|administration)\b/.test(q)) return 'public-affairs';
    if (/\b(breaking|headline|reported|journalist|coverage|current events)\b/.test(q)) return 'news';
    return 'general';
  }

  function readMap(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || '{}');
      return value && typeof value === 'object' ? value : {};
    } catch { return {}; }
  }

  function routeKey(query) {
    return clean(query, 500).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }

  function learnedRoute(query) {
    return readMap(ROUTE_KEY)[routeKey(query)] || null;
  }

  function saveRoute(query, route) {
    try {
      const routes = readMap(ROUTE_KEY);
      routes[routeKey(query)] = route;
      const trimmed = Object.fromEntries(Object.entries(routes).sort((a, b) => Number(b[1]?.at || 0) - Number(a[1]?.at || 0)).slice(0, 240));
      localStorage.setItem(ROUTE_KEY, JSON.stringify(trimmed));
    } catch {}
  }

  function saveEvent(event) {
    try {
      const prior = JSON.parse(localStorage.getItem(EVENT_KEY) || '[]');
      const events = Array.isArray(prior) ? prior : [];
      localStorage.setItem(EVENT_KEY, JSON.stringify([event, ...events].slice(0, 160)));
    } catch {}
  }

  function sourceEvidence() {
    const out = [];
    const seen = new Set();
    const push = (title, body, provider = '', url = '') => {
      title = clean(title, 220);
      body = clean(body, 900);
      provider = clean(provider, 100);
      url = clean(url, 1600);
      const key = (url || `${provider}:${title}`).toLowerCase();
      if (!title || !body || !key || seen.has(key)) return;
      seen.add(key);
      out.push({ title, body, provider, url });
    };

    document.querySelectorAll('.phi-orange-card[data-phi-media-source-backed="1"]').forEach((card) => {
      push(
        card.querySelector('h3')?.textContent,
        card.querySelector('.phi-orange-copy p')?.textContent || card.querySelector('p')?.textContent,
        card.dataset.phiMediaProvider || card.querySelector('.phi-media-v2-chip')?.textContent,
        card.dataset.phiMediaUrl
      );
    });

    document.querySelectorAll('.phi-green-card').forEach((card) => {
      push(
        card.querySelector('b')?.textContent,
        card.querySelector('p')?.textContent,
        card.querySelector('small')?.textContent,
        card.getAttribute('href') || ''
      );
    });

    if (!out.length) {
      document.querySelectorAll('.phi-orange-card').forEach((card) => {
        push(
          card.querySelector('h3')?.textContent,
          card.querySelector('.phi-orange-copy p')?.textContent || card.querySelector('p')?.textContent,
          'Infinity Phi preliminary card',
          ''
        );
      });
    }
    return out.slice(0, 18);
  }

  function signature(query, overview, cards) {
    const raw = `${query}|${overview}|${cards.map((item) => `${item.provider || ''}:${item.title}:${item.body}:${item.url || ''}`).join('|')}`;
    let hash = 2166136261;
    for (let i = 0; i < raw.length; i += 1) {
      hash ^= raw.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  function extractJson(text) {
    const raw = clean(text, 20000);
    if (!raw) return null;
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const source = fenced ? fenced[1].trim() : raw;
    try { return JSON.parse(source); } catch {}
    const start = source.indexOf('{');
    const end = source.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try { return JSON.parse(source.slice(start, end + 1)); } catch {}
    }
    return null;
  }

  async function askTeacher(query, domain, overview, cards) {
    const known = learnedRoute(query);
    const routeHint = domain === 'general' && known?.domain ? known.domain : domain;
    const input = `You are the teacher/evaluator behind Infinity Phi's AI Overview.\n\nCURRENT QUERY: ${query}\nLOCAL ROUTE: ${domain}\nLEARNED ROUTE IF ANY: ${routeHint}\nCURRENT OVERVIEW: ${overview}\nLIVE SOURCE RESULTS: ${JSON.stringify(cards)}\n\nDo two jobs:\n1. Decide the correct domain for the CURRENT QUERY only: chemistry, coins, software, screen, news, sports, public-affairs, science, or general. History is NOT evidence of current intent. A phrase that happens to also be a TV/movie title must not become screen unless the query itself indicates screen media.\n2. Write a corrected AI Overview that directly answers the CURRENT QUERY from the LIVE SOURCE RESULTS. Prefer the actual source-result titles, excerpts, providers, and URLs over preliminary semantic-card wording. Use only facts supported by the live source results/current overview. If the current overview is clearly from the wrong domain or stale query, discard it. For fringe science, treat it as a science concept unless the user explicitly asks for the TV series.\n\nReturn STRICT JSON only: {"domain":"science","confidence":0.98,"overview":"2-5 sentence answer","reason":"brief routing reason"}.`;

    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        input,
        context: {
          application: 'Infinity Phi',
          assistant: 'gpt',
          task: 'overview_teacher_watcher',
          verified_context: { page: location.href, user_query: query, history_policy: 'current-query-wins', evidence_policy: 'live-sources-win' }
        }
      })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message || payload.error || `HTTP ${response.status}`);
    return extractJson(String(payload.output_text || payload.output || ''));
  }

  async function run() {
    if (!onPhiPage() || busy) return;
    const deck = document.querySelector('.phi-editorial-deck');
    const query = queryText();
    if (!deck || !query) return;
    const overview = clean(deck.textContent, 1800);
    const cards = sourceEvidence();
    if (!overview || /Searching live sources/i.test(overview) || !cards.length) return;
    const sig = signature(query, overview, cards);
    if (sig === lastSignature || deck.dataset.gptOverviewSignature === sig) return;

    const domain = localDomain(query);
    busy = true;
    lastSignature = sig;
    document.documentElement.dataset.infinityPhiOverviewTeacher = 'thinking';
    try {
      const result = await askTeacher(query, domain, overview, cards);
      const allowed = new Set(['chemistry','coins','software','screen','news','sports','public-affairs','science','general']);
      const teacherDomain = allowed.has(result?.domain) ? result.domain : domain;
      const confidence = Math.max(0, Math.min(1, Number(result?.confidence) || 0));
      const revised = clean(result?.overview, 1800);
      if (routeKey(query) && confidence >= 0.7) saveRoute(query, { domain: teacherDomain, confidence, reason: clean(result?.reason, 260), at: Date.now() });
      if (revised) {
        deck.textContent = revised;
        deck.dataset.gptOverview = '1';
        deck.dataset.gptDomain = teacherDomain;
        const settledSignature = signature(query, revised, cards);
        deck.dataset.gptOverviewSignature = settledSignature;
        lastSignature = settledSignature;
      }
      const event = { query, localDomain: domain, teacherDomain, confidence, sourceCount: cards.length, originalOverview: overview, revisedOverview: revised, at: Date.now() };
      saveEvent(event);
      window.dispatchEvent(new CustomEvent('infinityphi:teacher-correction', { detail: event }));
      document.documentElement.dataset.infinityPhiOverviewTeacher = 'ready';
    } catch {
      document.documentElement.dataset.infinityPhiOverviewTeacher = 'fallback';
    } finally {
      busy = false;
    }
  }

  function schedule() {
    clearTimeout(timer);
    timer = window.setTimeout(run, 320);
  }

  if (!onPhiPage()) return;
  schedule();
  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  window.addEventListener('focus', schedule);
  window.addEventListener('popstate', schedule);
  window.addEventListener('infinityphi:media-cards-ready', schedule);
  window.addEventListener('infinityphi:live-sources-ready', schedule);
})();
