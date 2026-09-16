(() => {
  'use strict';

  if (!/\/phi(?:\/|$)/.test(location.pathname)) return;
  if (window.__infinityPhiSearchCoreV7) return;
  window.__infinityPhiSearchCoreV7 = true;

  const nativeFetch = window.fetch.bind(window);
  const broadCache = new Map();
  const MAX_WEB_RESULTS = 48;
  const MAX_TOTAL_RESULTS = 52;
  const MAX_PER_DOMAIN = 5;
  const REQUEST_MS = 3400;
  const INSTANT_MS = 1700;

  const VIDEO = /\b(video|videos|highlight|highlights|reel|reels|clip|clips|watch|plays|recap|footage|tutorial|demo|demonstration)\b/i;
  const NEWS = /\b(news|headlines?|updates?|latest|breaking|coverage)\b/i;
  const CATALOG = /\b(release|releases|released|release date|release dates|catalog|catalogue|filmography|discography|episodes?|premieres?|streaming|collection|timeline|list of|specials?)\b/i;
  const SPORTS = /\b(baseball|mlb|football|nfl|basketball|nba|wnba|hockey|nhl|soccer|mls|fifa|golf|pga|tennis|bowling|nascar|racing|sports?)\b/i;
  const SKIP = new Set(['the','and','for','with','from','about','into','this','that','what','when','where','which','who','why','how','are','was','were','has','have','had','your','you','its','our','their','there','then','than']);

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
      .replace(/!\[\[[^\]]*Image[^\]]*\]\]/gi, ' ')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
      .replace(/\[([^\]]+)\]\((?:https?:\/\/)?[^)]+\)/g, '$1')
      .replace(/(?:^|\s)https?:\/\/(?:imgs\.search\.brave\.com|search\.brave\.com|r\.jina\.ai)\/\S*/gi, ' ')
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\*{1,4}([^*]+)\*{1,4}/g, '$1')
      .replace(/_{1,3}([^_]+)_{1,3}/g, '$1')
      .replace(/~~([^~]+)~~/g, '$1')
      .replace(/(^|\s)[#>|]+(?=\s)/g, ' ')
      .replace(/\*{2,}|_{2,}|~{2,}/g, ' '), max);
  }

  const keyFor = (value) => clean(value, 500).toLowerCase();

  const domainOf = (value) => {
    try { return new URL(value).hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; }
  };

  const tokens = (value) => [...new Set(stripMarkup(value).toLowerCase().match(/[a-z0-9]+/g) || [])]
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
    if (domain.endsWith('nba.com')) return 'NBA.com';
    if (domain.endsWith('nhl.com')) return 'NHL.com';
    if (domain.endsWith('reddit.com')) return 'Reddit';
    return domain;
  }

  function queryIsAboutBrave(query) {
    return /\bbrave\b/i.test(clean(query));
  }

  function isSearchInfrastructure(url, title = '', extract = '', query = '') {
    const domain = domainOf(url);
    const text = stripMarkup(`${title} ${extract}`, 1200).toLowerCase();
    let parsed;
    try { parsed = new URL(url); } catch { return true; }
    const path = parsed.pathname.toLowerCase();

    if (!domain) return true;
    if (domain === 'r.jina.ai') return true;
    if (/^(?:www\.)?(?:google\.|bing\.|html\.duckduckgo\.|duckduckgo\.|search\.yahoo\.|search\.aol\.)/.test(domain)) return true;
    if (domain === 'imgs.search.brave.com' || domain === 'search.brave.com') return true;
    if (!queryIsAboutBrave(query) && (domain === 'brave.com' || domain.endsWith('.brave.com')) && /\b(brave search|search api|brave api|brave browser|brave rewards)\b/.test(text)) return true;
    if (/\/(?:search|images?|web-search)(?:\/|$)/i.test(path) && /\b(search|results?|images?)\b/.test(text)) return true;
    if (/\.(?:jpg|jpeg|png|gif|webp|avif|svg)(?:$|\?)/i.test(parsed.pathname) && /(?:cdn|image|img|media|thumb|static)/i.test(domain)) return true;
    if (/^image\s*\d*\s*:/i.test(stripMarkup(title, 180))) return true;
    return false;
  }

  function authority(item) {
    const domain = item.domain || domainOf(item.url);
    let score = 0;
    if (/\.(?:gov|edu)$/.test(domain)) score += 12;
    if (/^(?:d23\.com|abc\.com|disney\.com|disneyplus\.com|thewaltdisneycompany\.com)$/.test(domain)) score += 16;
    if (/^(?:espn\.com|foxsports\.com|mlb\.com|nfl\.com|nba\.com|nhl\.com)$/.test(domain)) score += 14;
    if (/^(?:imdb\.com|archive\.org)$/.test(domain)) score += 8;
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
      out.push(`${base} official dates episodes specials films archive database`);
      out.push(`${base} complete list history guide`);
    } else if (VIDEO.test(base)) {
      out.push(`${base} official video${SPORTS.test(base) ? ' ESPN FOX Sports' : ''}`);
      out.push(`${base} YouTube full highlights clips`);
    } else if (NEWS.test(base)) {
      out.push(`${base} official latest coverage`);
      out.push(`${base} reporting sources`);
    } else {
      out.push(`${base} official source guide`);
      out.push(`${base} history archive database`);
    }
    return [...new Set(out.map((item) => clean(item, 380)).filter(Boolean))].slice(0, 3);
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

    while ((match = pattern.exec(raw)) && out.length < 90) {
      const title = stripMarkup(match[1], 250);
      const url = unwrap(match[2]);
      const domain = domainOf(url);
      if (!title || !url || !domain) continue;
      if (isSearchInfrastructure(url, title, '', query)) continue;
      const dedupe = url.replace(/[?#].*$/, '').toLowerCase();
      if (seen.has(dedupe)) continue;
      seen.add(dedupe);

      const nearby = stripMarkup(
        raw.slice(pattern.lastIndex, pattern.lastIndex + 900)
          .replace(/\[[^\]]+\]\([^)]+\)/g, ' ')
          .replace(/^#+\s*/gm, ' '),
        720,
      );
      const id = videoId(url);
      const extract = nearby || `${title}. ${engine} web result for “${clean(query, 180)}”.`;
      if (isSearchInfrastructure(url, title, extract, query)) continue;
      if (!overlap(query, `${title} ${extract}`)) continue;
      out.push({
        title,
        url,
        domain,
        provider: providerFor(url),
        extract,
        image: id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : '',
        mediaType: id || domain.endsWith('youtube.com') ? 'video' : 'article',
        engine,
        order: order++,
      });
    }
    return out;
  }

  function scoreItem(item, query) {
    const title = stripMarkup(item.title).toLowerCase();
    const text = stripMarkup(`${item.title} ${item.extract}`).toLowerCase();
    const q = clean(query).toLowerCase();
    const titleHits = overlap(query, item.title);
    const allHits = overlap(query, text);
    let score = allHits * 15 + titleHits * 10 + Math.max(0, 36 - Number(item.order || 0)) + authority(item);
    if (q && text.includes(q)) score += 45;
    if (q && title.includes(q)) score += 28;
    if (CATALOG.test(query) && /\b(release|released|date|premiere|catalog|list|episode|special|film|streaming|archive)\b/i.test(text)) score += 24;
    if (NEWS.test(query) && /\b(news|report|update|latest|announced|announcement)\b/i.test(text)) score += 12;
    if (VIDEO.test(query)) score += item.mediaType === 'video' ? 60 : -6;
    if (/\b(api|developer docs?|search engine results?|image search)\b/i.test(title) && !/\b(api|developer|search engine)\b/i.test(query)) score -= 80;
    if ((item.extract || '').length < 65) score -= 12;
    return score;
  }

  async function instantAnswer(query) {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=0`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), INSTANT_MS);
    try {
      const response = await nativeFetch(url, { cache: 'no-store', signal: controller.signal });
      if (!response.ok) return [];
      const data = await response.json();
      const out = [];
      if (data.AbstractText && data.AbstractURL) {
        const title = stripMarkup(data.Heading || query, 240);
        const extract = stripMarkup(data.AbstractText, 2000);
        if (!isSearchInfrastructure(data.AbstractURL, title, extract, query)) out.push({
          title,
          url: data.AbstractURL,
          domain: domainOf(data.AbstractURL),
          provider: providerFor(data.AbstractURL),
          extract,
          image: data.Image || '',
          mediaType: 'article',
          engine: 'DuckDuckGo Instant',
          order: 0,
        });
      }
      return out;
    } catch {
      return [];
    } finally {
      clearTimeout(timer);
    }
  }

  async function searchPublicWeb(query) {
    const cacheKey = keyFor(query);
    if (broadCache.has(cacheKey)) return broadCache.get(cacheKey);

    const endpoints = [];
    queryVariants(query).forEach((phrase) => {
      const encoded = encodeURIComponent(phrase);
      endpoints.push({ engine: 'Google', url: `https://r.jina.ai/http://www.google.com/search?q=${encoded}&num=50` });
      endpoints.push({ engine: 'Bing', url: `https://r.jina.ai/http://www.bing.com/search?q=${encoded}&count=50` });
      endpoints.push({ engine: 'DuckDuckGo', url: `https://r.jina.ai/http://html.duckduckgo.com/html/?q=${encoded}` });
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
      const itemKey = clean(item.url, 1800).replace(/[?#].*$/, '').toLowerCase();
      if (!itemKey || seen.has(itemKey)) return false;
      if (isSearchInfrastructure(item.url, item.title, item.extract, query)) return false;
      if (!overlap(query, `${item.title} ${item.extract}`)) return false;
      seen.add(itemKey);
      item.title = stripMarkup(item.title, 250);
      item.extract = stripMarkup(item.extract, 1100);
      item.score = scoreItem(item, query);
      return Boolean(item.title && item.extract);
    }).sort((a, b) => b.score - a.score);

    const selected = [];
    const domainCounts = new Map();
    for (const item of unique) {
      const count = domainCounts.get(item.domain) || 0;
      const cap = VIDEO.test(query) && item.provider === 'YouTube' ? 10 : MAX_PER_DOMAIN;
      if (count >= cap) continue;
      domainCounts.set(item.domain, count + 1);
      selected.push(item);
      if (selected.length >= MAX_WEB_RESULTS) break;
    }

    broadCache.set(cacheKey, selected);
    return selected;
  }

  function pseudoPage(item, index) {
    let hash = 2166136261;
    const raw = `${item.url}|${index}`;
    for (let i = 0; i < raw.length; i += 1) {
      hash ^= raw.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return {
      pageid: -(Math.abs(hash || 1) + index),
      ns: 0,
      title: stripMarkup(`${item.provider}: ${item.title}`, 300),
      extract: stripMarkup(`${item.provider} source. ${item.extract || `${item.title}. Source-backed public web result.`}`, 2200),
      fullurl: item.url,
      provider: item.provider,
      mediaType: item.mediaType,
      thumbnail: item.image ? { source: item.image, width: 1280, height: 720 } : undefined,
    };
  }

  function cleanWikiPage(page) {
    return {
      ...page,
      title: stripMarkup(page?.title || '', 300),
      extract: stripMarkup(page?.extract || '', 2600),
    };
  }

  function mergePages(webItems, wikiPages, query) {
    const combined = [...webItems.map(pseudoPage), ...wikiPages.slice(0, 6).map(cleanWikiPage)];
    const seen = new Set();
    const domainCounts = new Map();
    const out = [];
    for (const page of combined) {
      const target = clean(page.fullurl || `${page.provider}:${page.title}`, 1800);
      if (!target) continue;
      if (page.fullurl && isSearchInfrastructure(page.fullurl, page.title, page.extract, query)) continue;
      const itemKey = target.replace(/[?#].*$/, '').toLowerCase();
      if (seen.has(itemKey)) continue;
      const domain = domainOf(page.fullurl || '') || clean(page.provider, 120).toLowerCase() || 'source';
      const count = domainCounts.get(domain) || 0;
      if (count >= MAX_PER_DOMAIN && !domain.includes('youtube.com')) continue;
      seen.add(itemKey);
      domainCounts.set(domain, count + 1);
      out.push(page);
      if (out.length >= MAX_TOTAL_RESULTS) break;
    }
    return out;
  }

  function jsonResponse(data) {
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    });
  }

  async function unifiedFetch(input, init) {
    const rawUrl = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input?.url || '';
    let parsed;
    try { parsed = new URL(rawUrl, location.href); } catch { return nativeFetch(input, init); }

    const isWikipediaSearch = parsed.hostname === 'en.wikipedia.org' && parsed.pathname.endsWith('/w/api.php') && parsed.searchParams.get('generator') === 'search';
    const isDuckDuckGo = parsed.hostname === 'api.duckduckgo.com';
    const isCrossref = parsed.hostname === 'api.crossref.org' && parsed.pathname.includes('/works');

    if (isDuckDuckGo) {
      const query = keyFor(parsed.searchParams.get('q') || '');
      if (query && broadCache.has(query)) return jsonResponse({ AbstractText: '', RelatedTopics: [] });
      return nativeFetch(input, init);
    }

    if (isCrossref) {
      const query = keyFor(parsed.searchParams.get('query') || '');
      if (query && broadCache.has(query)) return jsonResponse({ message: { items: [] } });
      return nativeFetch(input, init);
    }

    if (!isWikipediaSearch) return nativeFetch(input, init);
    const query = clean(parsed.searchParams.get('gsrsearch') || '', 500);
    if (!query) return nativeFetch(input, init);

    const [wikiResult, webResult] = await Promise.allSettled([
      nativeFetch(input, init),
      searchPublicWeb(query),
    ]);

    if (wikiResult.status !== 'fulfilled') throw wikiResult.reason;
    const response = wikiResult.value;
    if (!response.ok || webResult.status !== 'fulfilled' || !webResult.value.length) return response;

    let data;
    try { data = await response.clone().json(); } catch { return response; }
    const wikiPages = Object.values(data?.query?.pages || {});
    const pages = mergePages(webResult.value, wikiPages, query);
    if (!pages.length) return response;

    data.query = data.query || {};
    data.query.pages = Object.fromEntries(pages.map((page, index) => [`web_${index}`, page]));
    const headers = new Headers(response.headers);
    headers.delete('content-encoding');
    headers.delete('content-length');
    headers.set('content-type', 'application/json; charset=utf-8');
    return new Response(JSON.stringify(data), {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }

  window.fetch = unifiedFetch;
  window.InfinityPhiSearchIntelligence = {
    ...(window.InfinityPhiSearchIntelligence || {}),
    searchPublicWeb,
    queryVariants,
    stripMarkup,
    version: '2026-09-15-search-core-v7',
  };
})();
