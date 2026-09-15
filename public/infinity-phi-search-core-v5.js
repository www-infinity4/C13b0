(() => {
  'use strict';

  if (!/\/phi(?:\/|$)/.test(location.pathname)) return;
  if (window.__infinityPhiSearchCoreV5) return;
  window.__infinityPhiSearchCoreV5 = true;

  const nativeFetch = window.fetch.bind(window);
  const MAX_WEB_RESULTS = 30;
  const MAX_TOTAL_RESULTS = 34;
  const MAX_PER_DOMAIN = 4;
  const REQUEST_MS = 1900;

  const VIDEO = /\b(video|videos|highlight|highlights|reel|reels|clip|clips|watch|plays|recap|footage|tutorial|demo|demonstration)\b/i;
  const NEWS = /\b(news|headlines?|updates?|latest|breaking|coverage)\b/i;
  const CATALOG = /\b(release|releases|released|release date|release dates|catalog|catalogue|filmography|discography|episodes?|premieres?|streaming|collection|timeline|list of)\b/i;
  const SPORTS = /\b(baseball|mlb|football|nfl|basketball|nba|wnba|hockey|nhl|soccer|mls|fifa|golf|pga|tennis|bowling|nascar|racing|sports?)\b/i;
  const SKIP = new Set(['the','and','for','with','from','about','into','this','that','what','when','where','which','who','why','how','are','was','were','has','have','had','your','you','its','our','their','there','then','than']);

  const clean = (value, max = 3600) => String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);

  const domainOf = (value) => {
    try { return new URL(value).hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; }
  };

  const tokens = (value) => [...new Set(clean(value).toLowerCase().match(/[a-z0-9]+/g) || [])]
    .filter((word) => word.length > 2 && !SKIP.has(word));

  const overlap = (query, text) => {
    const haystack = new Set(tokens(text));
    return tokens(query).reduce((score, word) => score + Number(haystack.has(word)), 0);
  };

  function videoId(value) {
    try {
      const url = new URL(value);
      if (url.hostname === 'youtu.be') return url.pathname.split('/').filter(Boolean)[0] || '';
      if (url.hostname.endsWith('youtube.com')) return url.searchParams.get('v') || '';
    } catch {}
    return '';
  }

  function providerFor(value) {
    const domain = domainOf(value);
    if (!domain) return 'Public web';
    if (domain === 'youtu.be' || domain.endsWith('youtube.com')) return 'YouTube';
    if (domain.endsWith('wikipedia.org')) return 'Wikipedia';
    if (domain.endsWith('disney.com')) return 'Disney';
    if (domain.endsWith('disneyplus.com')) return 'Disney+';
    if (domain.endsWith('d23.com')) return 'D23';
    if (domain.endsWith('abc.com')) return 'ABC';
    if (domain.endsWith('thewaltdisneycompany.com')) return 'The Walt Disney Company';
    if (domain.endsWith('imdb.com')) return 'IMDb';
    if (domain.endsWith('archive.org')) return 'Internet Archive';
    if (domain.endsWith('espn.com')) return 'ESPN';
    if (domain.endsWith('foxsports.com')) return 'FOX Sports';
    if (domain.endsWith('mlb.com')) return 'MLB.com';
    if (domain.endsWith('nfl.com')) return 'NFL.com';
    return domain;
  }

  function authority(item) {
    const domain = item.domain || domainOf(item.url);
    let score = 0;
    if (/\.(?:gov|edu)$/.test(domain)) score += 12;
    if (/^(?:d23\.com|abc\.com|disney\.com|disneyplus\.com|thewaltdisneycompany\.com)$/.test(domain)) score += 16;
    if (/^(?:espn\.com|foxsports\.com|mlb\.com|nfl\.com|nba\.com|nhl\.com)$/.test(domain)) score += 14;
    if (domain === 'youtube.com' || domain.endsWith('.youtube.com')) score += 5;
    return score;
  }

  function unwrap(raw) {
    const value = clean(raw, 1900).replace(/&amp;/g, '&');
    try {
      const parsed = new URL(value);
      if (parsed.hostname.endsWith('google.com') && parsed.pathname === '/url' && parsed.searchParams.get('q')) {
        return decodeURIComponent(parsed.searchParams.get('q'));
      }
      if ((parsed.hostname.endsWith('google.com') || parsed.hostname.endsWith('bing.com')) && parsed.searchParams.get('url')) {
        return decodeURIComponent(parsed.searchParams.get('url'));
      }
      return parsed.toString();
    } catch { return ''; }
  }

  function queryVariants(query) {
    const base = clean(query, 380);
    if (!base) return [];
    const out = [base];

    if (CATALOG.test(base)) {
      out.push(`${base} official list dates`);
      out.push(`${base} archive complete list`);
      out.push(`${base} episodes films specials`);
    } else if (VIDEO.test(base)) {
      out.unshift(`${base} site:youtube.com/watch`);
      out.push(`${base} official video`);
      if (SPORTS.test(base)) out.push(`${base} ESPN FOX Sports official`);
    } else if (NEWS.test(base)) {
      out.push(`${base} official`);
      out.push(`${base} latest coverage`);
    } else {
      out.push(`${base} official`);
      out.push(`${base} source guide`);
    }

    return [...new Set(out.map((item) => clean(item, 380)).filter(Boolean))].slice(0, 4);
  }

  async function textFetch(url, ms = REQUEST_MS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    try {
      const response = await nativeFetch(url, {
        cache: 'no-store',
        signal: controller.signal,
        headers: { Accept: 'text/plain' },
      });
      if (!response.ok) return '';
      return await response.text();
    } catch {
      return '';
    } finally {
      clearTimeout(timer);
    }
  }

  function parseResults(text, query, engine) {
    const out = [];
    const seen = new Set();
    const raw = String(text || '');
    const pattern = /\[([^\]\n]{4,300})\]\((https?:\/\/[^)\s]+)\)/g;
    let match;
    let order = 0;

    while ((match = pattern.exec(raw)) && out.length < 70) {
      const title = clean(match[1], 250);
      const url = unwrap(match[2]);
      const domain = domainOf(url);
      if (!title || !url || !domain) continue;
      if (/^(?:www\.)?(?:google\.|bing\.|search\.brave\.|html\.duckduckgo\.|duckduckgo\.|r\.jina\.ai$)/.test(domain)) continue;
      if (/\/search(?:\?|$)/i.test(url)) continue;
      const key = url.replace(/[?#].*$/, '').toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

      const nearbyRaw = raw.slice(pattern.lastIndex, pattern.lastIndex + 760)
        .replace(/\[[^\]]+\]\([^)]+\)/g, ' ')
        .replace(/^#+\s*/gm, ' ');
      const nearby = clean(nearbyRaw, 620);
      const id = videoId(url);
      const relevance = overlap(query, `${title} ${nearby}`);
      if (!relevance) continue;

      out.push({
        title,
        url,
        domain,
        provider: providerFor(url),
        extract: nearby || `${title}. ${engine} web result for “${clean(query, 180)}”.`,
        image: id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : '',
        mediaType: id || domain.endsWith('youtube.com') ? 'video' : 'article',
        engine,
        order: order++,
      });
    }
    return out;
  }

  function scoreItem(item, query) {
    const title = clean(item.title).toLowerCase();
    const text = clean(`${item.title} ${item.extract}`).toLowerCase();
    const q = clean(query).toLowerCase();
    const titleHits = overlap(query, item.title);
    const allHits = overlap(query, text);
    let score = allHits * 15 + titleHits * 10 + Math.max(0, 32 - Number(item.order || 0)) + authority(item);
    if (q && text.includes(q)) score += 45;
    if (q && title.includes(q)) score += 28;
    if (CATALOG.test(query) && /\b(release|released|date|premiere|catalog|list|episode|special|film|streaming)\b/i.test(text)) score += 20;
    if (NEWS.test(query) && /\b(news|report|update|latest|announced|announcement)\b/i.test(text)) score += 12;
    if (VIDEO.test(query)) score += item.mediaType === 'video' ? 60 : -6;
    return score;
  }

  async function instantAnswer(query) {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=0`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1500);
    try {
      const response = await nativeFetch(url, { cache: 'no-store', signal: controller.signal });
      if (!response.ok) return [];
      const data = await response.json();
      const out = [];
      if (data.AbstractText && data.AbstractURL) out.push({
        title: clean(data.Heading || query, 240), url: data.AbstractURL, domain: domainOf(data.AbstractURL), provider: providerFor(data.AbstractURL),
        extract: clean(data.AbstractText, 2000), image: data.Image || '', mediaType: 'article', engine: 'DuckDuckGo Instant', order: 0,
      });
      (data.RelatedTopics || []).flatMap((item) => item.Topics || [item]).slice(0, 12).forEach((item, index) => {
        if (!item?.Text || !item?.FirstURL) return;
        out.push({
          title: clean(item.Text, 240).split(' - ')[0], url: item.FirstURL, domain: domainOf(item.FirstURL), provider: providerFor(item.FirstURL),
          extract: clean(item.Text, 1600), image: '', mediaType: 'article', engine: 'DuckDuckGo Instant', order: index + 1,
        });
      });
      return out;
    } catch { return []; }
    finally { clearTimeout(timer); }
  }

  async function searchPublicWeb(query) {
    const endpoints = [];
    queryVariants(query).forEach((phrase) => {
      const encoded = encodeURIComponent(phrase);
      endpoints.push({ engine: 'Google', url: `https://r.jina.ai/http://www.google.com/search?q=${encoded}` });
      endpoints.push({ engine: 'Bing', url: `https://r.jina.ai/http://www.bing.com/search?q=${encoded}` });
      endpoints.push({ engine: 'DuckDuckGo', url: `https://r.jina.ai/http://html.duckduckgo.com/html/?q=${encoded}` });
      endpoints.push({ engine: 'Brave', url: `https://r.jina.ai/http://search.brave.com/search?q=${encoded}` });
    });

    const [settled, instant] = await Promise.all([
      Promise.allSettled(endpoints.map(async (entry) => ({ ...entry, text: await textFetch(entry.url) }))),
      instantAnswer(query),
    ]);

    const raw = [...instant];
    settled.forEach((result) => {
      if (result.status !== 'fulfilled' || !result.value.text) return;
      raw.push(...parseResults(result.value.text, query, result.value.engine));
    });

    const seen = new Set();
    const unique = raw.filter((item) => {
      const key = clean(item.url, 1800).replace(/[?#].*$/, '').toLowerCase();
      if (!key || seen.has(key)) return false;
      if (!overlap(query, `${item.title} ${item.extract}`)) return false;
      seen.add(key);
      item.score = scoreItem(item, query);
      return true;
    }).sort((a, b) => b.score - a.score);

    const selected = [];
    const domainCounts = new Map();
    for (const item of unique) {
      const count = domainCounts.get(item.domain) || 0;
      const cap = VIDEO.test(query) && item.provider === 'YouTube' ? 8 : MAX_PER_DOMAIN;
      if (count >= cap) continue;
      domainCounts.set(item.domain, count + 1);
      selected.push(item);
      if (selected.length >= MAX_WEB_RESULTS) break;
    }
    return selected;
  }

  function pseudoPage(item, index) {
    let h = 2166136261;
    const raw = `${item.url}|${index}`;
    for (let i = 0; i < raw.length; i += 1) {
      h ^= raw.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return {
      pageid: -(Math.abs(h || 1) + index), ns: 0, title: item.title,
      extract: item.extract || `${item.title}. Source-backed public web result.`, fullurl: item.url,
      provider: item.provider, mediaType: item.mediaType,
      thumbnail: item.image ? { source: item.image, width: 1280, height: 720 } : undefined,
    };
  }

  function mergePages(webItems, wikiPages) {
    const combined = [...webItems.map(pseudoPage), ...wikiPages.slice(0, 4)];
    const seen = new Set();
    const domainCounts = new Map();
    const out = [];
    for (const page of combined) {
      const target = clean(page.fullurl || `${page.provider}:${page.title}`, 1800);
      if (!target) continue;
      const key = target.replace(/[?#].*$/, '').toLowerCase();
      if (seen.has(key)) continue;
      const domain = domainOf(page.fullurl || '') || clean(page.provider, 120).toLowerCase() || 'source';
      const count = domainCounts.get(domain) || 0;
      if (count >= MAX_PER_DOMAIN && !domain.includes('youtube.com')) continue;
      seen.add(key);
      domainCounts.set(domain, count + 1);
      out.push(page);
      if (out.length >= MAX_TOTAL_RESULTS) break;
    }
    return out;
  }

  async function unifiedFetch(input, init) {
    const rawUrl = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input?.url || '';
    let parsed;
    try { parsed = new URL(rawUrl, location.href); } catch { return nativeFetch(input, init); }
    const isWikipediaSearch = parsed.hostname === 'en.wikipedia.org' && parsed.pathname.endsWith('/w/api.php') && parsed.searchParams.get('generator') === 'search';
    if (!isWikipediaSearch) return nativeFetch(input, init);
    const query = clean(parsed.searchParams.get('gsrsearch') || '', 500);
    if (!query) return nativeFetch(input, init);

    const [wikiResult, webResult] = await Promise.allSettled([nativeFetch(input, init), searchPublicWeb(query)]);
    if (wikiResult.status !== 'fulfilled') throw wikiResult.reason;
    const response = wikiResult.value;
    if (!response.ok || webResult.status !== 'fulfilled' || !webResult.value.length) return response;

    let data;
    try { data = await response.clone().json(); } catch { return response; }
    const wikiPages = Object.values(data?.query?.pages || {});
    const pages = mergePages(webResult.value, wikiPages);
    if (!pages.length) return response;
    data.query = data.query || {};
    data.query.pages = Object.fromEntries(pages.map((page, index) => [`web_${index}`, page]));
    const headers = new Headers(response.headers);
    headers.delete('content-encoding'); headers.delete('content-length'); headers.set('content-type', 'application/json; charset=utf-8');
    return new Response(JSON.stringify(data), { status: response.status, statusText: response.statusText, headers });
  }

  window.fetch = unifiedFetch;
  window.InfinityPhiSearchIntelligence = {
    ...(window.InfinityPhiSearchIntelligence || {}),
    searchPublicWeb,
    queryVariants,
    version: '2026-09-15-search-core-v5',
  };
})();
