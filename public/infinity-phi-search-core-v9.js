(() => {
  'use strict';

  if (!/\/phi(?:\/|$)/.test(location.pathname)) return;
  if (window.__infinityPhiSearchCoreV9) return;
  window.__infinityPhiSearchCoreV9 = true;

  const nativeFetch = window.fetch.bind(window);
  const cache = new Map();
  const REQUEST_MS = 3600;
  const WIKI_MS = 4200;
  const INSTANT_MS = 2400;
  const MAX_RESULTS = 30;
  const MAX_PER_DOMAIN = 4;

  const NEWS = /\b(news|headlines?|updates?|latest|breaking|coverage|current events?)\b/i;
  const VIDEO = /\b(video|videos|highlight|highlights|reel|reels|clip|clips|watch|plays|recap|footage|tutorial|demo|demonstration)\b/i;
  const CATALOG = /\b(release|releases|released|release date|release dates|catalog|catalogue|filmography|discography|episodes?|premieres?|streaming|collection|timeline|list of|specials?)\b/i;
  const SPORTS = /\b(baseball|mlb|football|nfl|basketball|nba|wnba|hockey|nhl|soccer|mls|fifa|golf|pga|tennis|bowling|nascar|racing|sports?)\b/i;
  const GENERIC_NEWS = /^(?:world\s+)?(?:latest\s+|breaking\s+|current\s+)?(?:world\s+)?news(?:\s+today)?$/i;
  const SKIP = new Set(['the','and','for','with','from','about','into','this','that','what','when','where','which','who','why','how','are','was','were','has','have','had','your','you','its','our','their','there','then','than','news','latest']);
  const NEWS_AUTHORITY = new Map([
    ['reuters.com', 32], ['apnews.com', 32], ['bbc.com', 28], ['bbc.co.uk', 28],
    ['npr.org', 24], ['cnn.com', 22], ['cbsnews.com', 22], ['nbcnews.com', 22],
    ['abcnews.go.com', 22], ['theguardian.com', 20], ['aljazeera.com', 20], ['foxnews.com', 20],
    ['nytimes.com', 18], ['washingtonpost.com', 18]
  ]);

  const clean = (value, max = 3600) => String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);

  function stripMarkup(value, max = 3600) {
    return clean(String(value || '')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
      .replace(/\[([^\]]+)\]\((?:https?:\/\/)?[^)]+\)/g, '$1')
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\*{1,4}([^*]+)\*{1,4}/g, '$1')
      .replace(/_{1,3}([^_]+)_{1,3}/g, '$1')
      .replace(/~~([^~]+)~~/g, '$1')
      .replace(/(^|\s)[#>|]+(?=\s)/g, ' '), max);
  }

  function normalizeQuery(value) {
    const query = clean(value, 500);
    if (!query) return '';
    // Preserve what the user typed in the UI, but make the retrieval layer
    // tolerate the common "word news" -> "world news" typo like a search engine.
    return query.replace(/^word(?=\s+news\b)/i, 'world');
  }

  const keyFor = (value) => normalizeQuery(value).toLowerCase();
  const domainOf = (value) => { try { return new URL(value).hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; } };
  const tokens = (value) => [...new Set(stripMarkup(value).toLowerCase().match(/[a-z0-9]+/g) || [])].filter((word) => word.length > 2 && !SKIP.has(word));
  const overlap = (query, text) => {
    const haystack = new Set(tokens(text));
    return tokens(normalizeQuery(query)).reduce((score, word) => score + Number(haystack.has(word)), 0);
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
    if (domain.endsWith('reuters.com')) return 'Reuters';
    if (domain.endsWith('apnews.com')) return 'Associated Press';
    if (domain.endsWith('bbc.com') || domain.endsWith('bbc.co.uk')) return 'BBC';
    if (domain.endsWith('npr.org')) return 'NPR';
    if (domain.endsWith('cnn.com')) return 'CNN';
    if (domain.endsWith('cbsnews.com')) return 'CBS News';
    if (domain.endsWith('nbcnews.com')) return 'NBC News';
    if (domain.endsWith('abcnews.go.com')) return 'ABC News';
    if (domain.endsWith('espn.com')) return 'ESPN';
    if (domain.endsWith('foxsports.com')) return 'FOX Sports';
    if (domain.endsWith('mlb.com')) return 'MLB.com';
    if (domain.endsWith('nfl.com')) return 'NFL.com';
    if (domain.endsWith('nba.com')) return 'NBA.com';
    if (domain.endsWith('nhl.com')) return 'NHL.com';
    return domain;
  }

  function authority(domain, query) {
    let score = 0;
    if (/\.(?:gov|edu)$/.test(domain)) score += 12;
    if (NEWS.test(query)) {
      for (const [name, points] of NEWS_AUTHORITY) {
        if (domain === name || domain.endsWith(`.${name}`)) score += points;
      }
    }
    if (/^(?:espn\.com|foxsports\.com|mlb\.com|nfl\.com|nba\.com|nhl\.com)$/.test(domain)) score += 16;
    return score;
  }

  function isSearchInfrastructure(url, title = '') {
    const domain = domainOf(url);
    if (!domain) return true;
    if (domain === 'r.jina.ai') return true;
    if (/^(?:google\.|bing\.|html\.duckduckgo\.|duckduckgo\.|search\.yahoo\.)/.test(domain)) return true;
    if (domain === 'search.brave.com' || domain === 'imgs.search.brave.com') return true;
    try {
      const parsed = new URL(url);
      if (/\/(?:search|images?|web-search)(?:\/|$)/i.test(parsed.pathname) && /\b(search|results?|images?)\b/i.test(title)) return true;
    } catch {}
    return false;
  }

  function unwrap(raw) {
    const value = clean(raw, 1900).replace(/&amp;/g, '&');
    try {
      const parsed = new URL(value);
      if (parsed.hostname.endsWith('google.com') && parsed.pathname === '/url' && parsed.searchParams.get('q')) return decodeURIComponent(parsed.searchParams.get('q'));
      if ((parsed.hostname.endsWith('google.com') || parsed.hostname.endsWith('bing.com')) && parsed.searchParams.get('url')) return decodeURIComponent(parsed.searchParams.get('url'));
      return parsed.toString();
    } catch { return ''; }
  }

  function queryVariants(query) {
    const base = normalizeQuery(query);
    if (!base) return [];
    const out = [base];
    if (NEWS.test(base)) out.push(`${base} Reuters AP BBC latest headlines today`);
    else if (VIDEO.test(base)) out.push(`${base} YouTube official${SPORTS.test(base) ? ' ESPN FOX Sports' : ''}`);
    else if (CATALOG.test(base)) out.push(`${base} official complete list dates archive database`);
    else if (SPORTS.test(base)) out.push(`${base} official ESPN FOX Sports`);
    else out.push(`${base} official source guide`);
    return [...new Set(out.map((item) => clean(item, 380)).filter(Boolean))].slice(0, 2);
  }

  async function textFetch(url, ms = REQUEST_MS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    try {
      const response = await nativeFetch(url, { cache: 'no-store', signal: controller.signal, headers: { Accept: 'text/plain' } });
      if (!response.ok) return '';
      return await response.text();
    } catch { return ''; }
    finally { clearTimeout(timer); }
  }

  async function responseWithin(input, init, ms) {
    return Promise.race([
      nativeFetch(input, init).catch(() => null),
      new Promise((resolve) => setTimeout(() => resolve(null), ms)),
    ]);
  }

  function acceptsResult(query, item) {
    const normalized = normalizeQuery(query);
    const text = `${item.title} ${item.extract}`;
    if (overlap(normalized, text) > 0) return true;
    if (NEWS.test(normalized) && GENERIC_NEWS.test(normalized)) {
      if (authority(item.domain, normalized) > 0) return true;
      return item.title.length > 18 && item.extract.length > 45;
    }
    return false;
  }

  function parseResults(text, query, engine) {
    const out = [];
    const seen = new Set();
    const raw = String(text || '');
    const pattern = /\[([^\]\n]{4,300})\]\((https?:\/\/[^)\s]+)\)/g;
    let match;
    let order = 0;
    while ((match = pattern.exec(raw)) && out.length < 70) {
      const title = stripMarkup(match[1], 250);
      const url = unwrap(match[2]);
      const domain = domainOf(url);
      if (!title || !url || !domain || isSearchInfrastructure(url, title)) continue;
      const dedupe = url.replace(/[?#].*$/, '').toLowerCase();
      if (seen.has(dedupe)) continue;
      seen.add(dedupe);
      const nearby = stripMarkup(raw.slice(pattern.lastIndex, pattern.lastIndex + 760).replace(/\[[^\]]+\]\([^)]+\)/g, ' '), 620);
      const id = videoId(url);
      const item = {
        title,
        url,
        domain,
        provider: providerFor(url),
        extract: nearby || `${title}. ${engine} result.`,
        image: id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : '',
        mediaType: id || domain.endsWith('youtube.com') ? 'video' : 'article',
        engine,
        order: order++,
      };
      if (acceptsResult(query, item)) out.push(item);
    }
    return out;
  }

  function scoreItem(item, query) {
    const normalized = normalizeQuery(query);
    const text = stripMarkup(`${item.title} ${item.extract}`).toLowerCase();
    const q = normalized.toLowerCase();
    let score = overlap(normalized, text) * 18 + Math.max(0, 30 - Number(item.order || 0)) + authority(item.domain, normalized);
    if (q && text.includes(q)) score += 35;
    if (NEWS.test(normalized) && authority(item.domain, normalized) > 0) score += 18;
    if (VIDEO.test(normalized) && item.mediaType === 'video') score += 50;
    return score;
  }

  async function instantAnswer(query) {
    const normalized = normalizeQuery(query);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), INSTANT_MS);
    try {
      const response = await nativeFetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(normalized)}&format=json&no_html=1&skip_disambig=0`, {
        cache: 'no-store', signal: controller.signal,
      });
      if (!response.ok) return [];
      const data = await response.json();
      const out = [];
      if (data.AbstractText && data.AbstractURL) {
        out.push({
          title: stripMarkup(data.Heading || normalized, 250),
          url: data.AbstractURL,
          domain: domainOf(data.AbstractURL),
          provider: providerFor(data.AbstractURL),
          extract: stripMarkup(data.AbstractText, 1600),
          image: data.Image || '',
          mediaType: 'article',
          engine: 'DuckDuckGo Instant',
          order: 0,
        });
      }
      return out.filter((item) => acceptsResult(normalized, item));
    } catch { return []; }
    finally { clearTimeout(timer); }
  }

  async function searchPublicWeb(query) {
    const normalized = normalizeQuery(query);
    const cacheKey = keyFor(normalized);
    if (cache.has(cacheKey)) return cache.get(cacheKey);

    const endpoints = [];
    queryVariants(normalized).forEach((phrase) => {
      const encoded = encodeURIComponent(phrase);
      endpoints.push({ engine: 'Google', url: `https://r.jina.ai/http://www.google.com/search?q=${encoded}&num=30` });
      endpoints.push({ engine: 'Bing', url: `https://r.jina.ai/http://www.bing.com/search?q=${encoded}&count=30` });
      endpoints.push({ engine: 'DuckDuckGo', url: `https://r.jina.ai/http://html.duckduckgo.com/html/?q=${encoded}` });
    });

    const [settled, instant] = await Promise.all([
      Promise.allSettled(endpoints.slice(0, 6).map(async (entry) => ({ ...entry, text: await textFetch(entry.url) }))),
      instantAnswer(normalized),
    ]);

    const raw = [...instant];
    settled.forEach((result) => {
      if (result.status === 'fulfilled' && result.value.text) raw.push(...parseResults(result.value.text, normalized, result.value.engine));
    });

    const seen = new Set();
    const domainCounts = new Map();
    const unique = raw
      .filter((item) => {
        const key = item.url.replace(/[?#].*$/, '').toLowerCase();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((item) => ({ ...item, score: scoreItem(item, normalized) }))
      .sort((a, b) => b.score - a.score)
      .filter((item) => {
        const count = domainCounts.get(item.domain) || 0;
        const cap = VIDEO.test(normalized) && item.provider === 'YouTube' ? 8 : MAX_PER_DOMAIN;
        if (count >= cap) return false;
        domainCounts.set(item.domain, count + 1);
        return true;
      })
      .slice(0, MAX_RESULTS);

    // An empty cache entry is intentionally retained for de-duplicating the broad
    // search itself, but it must NOT disable the app's DuckDuckGo/Crossref fallbacks.
    cache.set(cacheKey, unique);
    return unique;
  }

  function pseudoPage(item, index) {
    let h = 2166136261;
    const raw = `${item.url}|${index}`;
    for (let i = 0; i < raw.length; i += 1) { h ^= raw.charCodeAt(i); h = Math.imul(h, 16777619); }
    return {
      pageid: -(Math.abs(h || 1) + index), ns: 0,
      title: item.title,
      extract: item.extract || `${item.title}. Source-backed public web result.`,
      fullurl: item.url,
      provider: item.provider,
      mediaType: item.mediaType,
      thumbnail: item.image ? { source: item.image, width: 1280, height: 720 } : undefined,
    };
  }

  function mergePages(webItems, wikiPages) {
    const out = [];
    const seen = new Set();
    [...webItems.map(pseudoPage), ...wikiPages].forEach((page) => {
      const key = clean(page.fullurl || `${page.provider || 'Wikipedia'}:${page.title}`, 1800).toLowerCase();
      if (!key || seen.has(key)) return;
      seen.add(key);
      out.push(page);
    });
    return out.slice(0, MAX_RESULTS);
  }

  function jsonResponse(data) {
    return new Response(JSON.stringify(data), { status: 200, headers: { 'content-type': 'application/json; charset=utf-8' } });
  }

  async function unifiedFetch(input, init) {
    const rawUrl = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input?.url || '';
    let parsed;
    try { parsed = new URL(rawUrl, location.href); } catch { return nativeFetch(input, init); }

    const isWikipediaSearch = parsed.hostname === 'en.wikipedia.org' && parsed.pathname.endsWith('/w/api.php') && parsed.searchParams.get('generator') === 'search';
    const isDuckDuckGo = parsed.hostname === 'api.duckduckgo.com';
    const isCrossref = parsed.hostname === 'api.crossref.org' && parsed.pathname.includes('/works');

    if (isDuckDuckGo || isCrossref) {
      const rawQuery = isDuckDuckGo ? (parsed.searchParams.get('q') || '') : (parsed.searchParams.get('query') || '');
      const cached = cache.get(keyFor(rawQuery));
      // Only suppress duplicate fallback calls when the broad search actually
      // produced material. v8 suppressed these even when its cached result was [].
      if (cached && cached.length) {
        return isDuckDuckGo
          ? jsonResponse({ AbstractText: '', RelatedTopics: [] })
          : jsonResponse({ message: { items: [] } });
      }
      return nativeFetch(input, init);
    }

    if (!isWikipediaSearch) return nativeFetch(input, init);
    const query = clean(parsed.searchParams.get('gsrsearch') || '', 500);
    if (!query) return nativeFetch(input, init);

    const [wikiResult, webResult] = await Promise.all([
      responseWithin(input, init, WIKI_MS),
      searchPublicWeb(query).catch(() => []),
    ]);

    let data = { query: { pages: {} } };
    const response = wikiResult;
    if (response && response.ok) {
      try { data = await response.clone().json(); } catch {}
    }
    const wikiPages = Object.values(data?.query?.pages || {});
    const pages = mergePages(webResult || [], wikiPages);
    if (!pages.length && response) return response;

    data.query = data.query || {};
    data.query.pages = Object.fromEntries(pages.map((page, index) => [`web_${index}`, page]));
    return jsonResponse(data);
  }

  window.fetch = unifiedFetch;
  window.InfinityPhiSearchIntelligence = {
    ...(window.InfinityPhiSearchIntelligence || {}),
    searchPublicWeb,
    queryVariants,
    normalizeQuery,
    stripMarkup,
    version: '2026-09-15-search-core-v9',
  };
})();
