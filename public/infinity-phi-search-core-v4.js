(() => {
  'use strict';

  if (!/\/phi(?:\/|$)/.test(location.pathname)) return;
  if (window.__infinityPhiSearchCoreV4) return;
  window.__infinityPhiSearchCoreV4 = true;

  const baseFetch = window.fetch.bind(window);
  const MAX_WEB_RESULTS = 26;
  const MAX_TOTAL_RESULTS = 30;
  const MAX_PER_DOMAIN = 3;
  const VIDEO = /\b(video|videos|highlight|highlights|reel|reels|clip|clips|watch|plays|recap|footage|tutorial|demo|demonstration)\b/i;
  const NEWS = /\b(news|headlines?|updates?|latest|breaking|coverage)\b/i;
  const CATALOG = /\b(release|releases|released|release date|release dates|catalog|catalogue|filmography|discography|episodes?|premieres?|streaming|collection|timeline|list of)\b/i;
  const SPORTS = /\b(baseball|mlb|football|nfl|basketball|nba|wnba|hockey|nhl|soccer|mls|fifa|golf|pga|tennis|bowling|nascar|racing|sports?)\b/i;
  const SKIP = new Set([
    'the','and','for','with','from','about','into','this','that','what','when','where','which','who','why','how','are','was','were','has','have','had','your','you','its','our','their','there','then','than'
  ]);

  const clean = (value, max = 3200) => String(value || '')
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
    if (domain.endsWith('thewaltdisneycompany.com')) return 'The Walt Disney Company';
    if (domain.endsWith('imdb.com')) return 'IMDb';
    if (domain.endsWith('archive.org')) return 'Internet Archive';
    if (domain.endsWith('espn.com')) return 'ESPN';
    if (domain.endsWith('foxsports.com')) return 'FOX Sports';
    if (domain.endsWith('mlb.com')) return 'MLB.com';
    if (domain.endsWith('nfl.com')) return 'NFL.com';
    return domain;
  }

  function unwrap(raw) {
    const value = clean(raw, 1800).replace(/&amp;/g, '&');
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
    const base = clean(query, 360);
    if (!base) return [];
    const out = [base];

    if (CATALOG.test(base)) {
      out.push(`${base} official list`);
      out.push(`${base} dates archive`);
      out.push(`${base} complete catalog`);
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

    return [...new Set(out.map((item) => clean(item, 360)).filter(Boolean))].slice(0, 4);
  }

  async function textFetch(url, ms = 3400) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    try {
      const response = await baseFetch(url, {
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
    const pattern = /\[([^\]\n]{4,280})\]\((https?:\/\/[^)\s]+)\)/g;
    let match;
    let order = 0;

    while ((match = pattern.exec(raw)) && out.length < 60) {
      const title = clean(match[1], 240);
      const url = unwrap(match[2]);
      const domain = domainOf(url);
      if (!title || !url || !domain) continue;
      if (/^(?:www\.)?(?:google\.|bing\.|r\.jina\.ai$)/.test(domain)) continue;
      if (/\/search(?:\?|$)/i.test(url)) continue;

      const key = url.replace(/[?#].*$/, '').toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

      const nearbyRaw = raw.slice(pattern.lastIndex, pattern.lastIndex + 650)
        .replace(/\[[^\]]+\]\([^)]+\)/g, ' ')
        .replace(/^#+\s*/gm, ' ');
      const nearby = clean(nearbyRaw, 520);
      const id = videoId(url);
      const combined = `${title} ${nearby}`;
      const relevance = overlap(query, combined);
      if (!relevance) continue;

      out.push({
        title,
        url,
        domain,
        provider: providerFor(url),
        extract: nearby || `${title}. ${engine} result for “${clean(query, 180)}”.`,
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
    let score = allHits * 14 + titleHits * 9 + Math.max(0, 30 - Number(item.order || 0));

    if (q && text.includes(q)) score += 42;
    if (q && title.includes(q)) score += 24;
    if (CATALOG.test(query) && /\b(release|released|date|premiere|catalog|list|episode|streaming)\b/i.test(text)) score += 16;
    if (NEWS.test(query) && /\b(news|report|update|latest|announced|announcement)\b/i.test(text)) score += 10;
    if (VIDEO.test(query)) score += item.mediaType === 'video' ? 55 : -8;
    if (/\.(?:gov|edu)$/.test(item.domain)) score += 7;
    if (item.engine === 'Google') score += 2;
    return score;
  }

  async function searchPublicWeb(query) {
    const endpoints = [];
    queryVariants(query).forEach((phrase) => {
      const encoded = encodeURIComponent(phrase);
      endpoints.push({ engine: 'Google', url: `https://r.jina.ai/http://www.google.com/search?q=${encoded}` });
      endpoints.push({ engine: 'Bing', url: `https://r.jina.ai/http://www.bing.com/search?q=${encoded}` });
    });

    const settled = await Promise.allSettled(endpoints.map(async (entry) => ({
      ...entry,
      text: await textFetch(entry.url),
    })));

    const raw = [];
    settled.forEach((result) => {
      if (result.status !== 'fulfilled' || !result.value.text) return;
      raw.push(...parseResults(result.value.text, query, result.value.engine));
    });

    const seen = new Set();
    const unique = raw.filter((item) => {
      const key = item.url.replace(/[?#].*$/, '').toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      item.score = scoreItem(item, query);
      return true;
    }).sort((a, b) => b.score - a.score);

    const selected = [];
    const domainCounts = new Map();
    for (const item of unique) {
      const count = domainCounts.get(item.domain) || 0;
      const cap = VIDEO.test(query) && item.provider === 'YouTube' ? 7 : MAX_PER_DOMAIN;
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
      pageid: -(Math.abs(h || 1) + index),
      ns: 0,
      title: item.title,
      extract: item.extract || `${item.title}. Source-backed public web result.`,
      fullurl: item.url,
      provider: item.provider,
      mediaType: item.mediaType,
      thumbnail: item.image ? { source: item.image, width: 1280, height: 720 } : undefined,
    };
  }

  function mergePages(webItems, wikiPages) {
    const combined = [
      ...webItems.map(pseudoPage),
      ...wikiPages.slice(0, 4),
    ];
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
    try { parsed = new URL(rawUrl, location.href); } catch { return baseFetch(input, init); }

    const isWikipediaSearch = parsed.hostname === 'en.wikipedia.org' &&
      parsed.pathname.endsWith('/w/api.php') &&
      parsed.searchParams.get('generator') === 'search';
    if (!isWikipediaSearch) return baseFetch(input, init);

    const query = clean(parsed.searchParams.get('gsrsearch') || '', 500);
    if (!query) return baseFetch(input, init);

    const [wikiResult, webResult] = await Promise.allSettled([
      baseFetch(input, init),
      searchPublicWeb(query),
    ]);

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
    version: '2026-09-15-search-core-v4',
  };
})();
