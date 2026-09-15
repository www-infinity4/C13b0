(() => {
  'use strict';

  const upstreamFetch = window.fetch.bind(window);
  const MAX_RESULTS = 16;
  const VIDEO_INTENT = /\b(video|videos|highlight|highlights|reel|reels|clip|clips|watch|plays|top plays|best plays|recap|footage|tutorial|demo|demonstration)\b/i;
  const SPORTS = /\b(baseball|mlb|football|nfl|basketball|nba|wnba|hockey|nhl|soccer|mls|fifa|golf|pga|tennis|bowling|nascar|racing|sports?)\b/i;
  const GENERIC_QUESTION = /^(?:what does (?:this|the) evidence show|when did .+ become important|where did .+ begin|who was involved in|how did .+ begin|a closer look at)\b/i;
  const SKIP = new Set(['the','and','for','with','from','about','into','this','that','what','when','where','which','who','why','how','are','was','were','has','have','had','your','you','its','our']);

  const clean = (value, max = 2600) => String(value || '')
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

  const queryTokens = (value) => [...new Set(clean(value).toLowerCase().match(/[a-z0-9]+/g) || [])]
    .filter((word) => word.length > 2 && !SKIP.has(word));

  function overlap(query, text) {
    const haystack = new Set(queryTokens(text));
    return queryTokens(query).reduce((score, word) => score + Number(haystack.has(word)), 0);
  }

  function videoId(url) {
    try {
      const parsed = new URL(url);
      if (parsed.hostname === 'youtu.be') return parsed.pathname.split('/').filter(Boolean)[0] || '';
      if (parsed.hostname.endsWith('youtube.com')) return parsed.searchParams.get('v') || '';
    } catch {}
    return '';
  }

  function isVideoUrl(url) {
    const domain = domainOf(url);
    return Boolean(videoId(url) || domain === 'youtu.be' || domain.endsWith('youtube.com') || /\/(video|videos|watch|clips?)\b/i.test(url));
  }

  function providerFor(url) {
    const domain = domainOf(url);
    if (domain === 'youtu.be' || domain.endsWith('youtube.com')) return 'YouTube';
    if (domain === 'mlb.com' || domain.endsWith('.mlb.com')) return 'MLB.com';
    if (domain === 'espn.com' || domain.endsWith('.espn.com')) return 'ESPN';
    if (domain === 'foxsports.com' || domain.endsWith('.foxsports.com')) return 'FOX Sports';
    return domain || 'Web';
  }

  function unwrapResultUrl(raw) {
    const value = clean(raw, 1800).replace(/&amp;/g, '&');
    try {
      const parsed = new URL(value);
      if ((parsed.hostname.endsWith('google.com') || parsed.hostname.endsWith('bing.com')) && parsed.searchParams.get('url')) {
        return decodeURIComponent(parsed.searchParams.get('url'));
      }
      if (parsed.hostname.endsWith('google.com') && parsed.pathname === '/url' && parsed.searchParams.get('q')) {
        return decodeURIComponent(parsed.searchParams.get('q'));
      }
      return parsed.toString();
    } catch { return ''; }
  }

  function parseMarkdownResults(text, query, sourceName) {
    const matches = [];
    const seen = new Set();
    const pattern = /\[([^\]\n]{4,260})\]\((https?:\/\/[^)\s]+)\)/g;
    let match;
    let order = 0;
    while ((match = pattern.exec(String(text || ''))) && matches.length < 30) {
      const title = clean(match[1], 220);
      const url = unwrapResultUrl(match[2]);
      const domain = domainOf(url);
      if (!title || !url || !domain) continue;
      if (/^(google\.|bing\.|r\.jina\.ai$)/.test(domain) || domain.includes('webcache') || /\/search(?:\?|$)/.test(url)) continue;
      const key = url.replace(/[?#].*$/, '').toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const nearby = clean(String(text || '').slice(pattern.lastIndex, pattern.lastIndex + 420), 340);
      matches.push({
        title,
        url,
        domain,
        provider: providerFor(url),
        extract: nearby && overlap(query, nearby) ? nearby : `${title}. ${sourceName} web result matched to “${clean(query, 180)}”.`,
        image: videoId(url) ? `https://i.ytimg.com/vi/${videoId(url)}/hqdefault.jpg` : '',
        mediaType: isVideoUrl(url) ? 'video' : 'article',
        order: order++
      });
    }
    return matches;
  }

  async function textFetch(url, ms = 5200) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    try {
      const response = await upstreamFetch(url, { cache: 'no-store', signal: controller.signal, headers: { Accept: 'text/plain' } });
      if (!response.ok) return '';
      return await response.text();
    } catch {
      return '';
    } finally {
      clearTimeout(timer);
    }
  }

  async function searchPublicWeb(query) {
    const wantsVideo = VIDEO_INTENT.test(query);
    const searches = [query];
    if (wantsVideo) searches.unshift(`${query} site:youtube.com/watch`);
    if (wantsVideo && SPORTS.test(query)) searches.push(`${query} MLB ESPN FOX Sports`);

    const endpoints = [];
    for (const phrase of [...new Set(searches)].slice(0, 3)) {
      const encoded = encodeURIComponent(phrase);
      endpoints.push({ name: 'Google', url: `https://r.jina.ai/http://www.google.com/search?q=${encoded}` });
      endpoints.push({ name: 'Bing', url: `https://r.jina.ai/http://www.bing.com/search?q=${encoded}` });
    }

    const settled = await Promise.allSettled(endpoints.map(async (entry) => ({ ...entry, text: await textFetch(entry.url) })));
    const raw = [];
    settled.forEach((result) => {
      if (result.status !== 'fulfilled' || !result.value.text) return;
      raw.push(...parseMarkdownResults(result.value.text, query, result.value.name));
    });

    const seen = new Set();
    const unique = raw.filter((item) => {
      const key = item.url.replace(/[?#].*$/, '').toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const qLower = clean(query).toLowerCase();
    const authority = (item) => {
      if (!SPORTS.test(query)) return 0;
      if (item.provider === 'MLB.com') return 20;
      if (item.provider === 'ESPN' || item.provider === 'FOX Sports') return 17;
      if (item.provider === 'YouTube') return 10;
      return 0;
    };

    unique.forEach((item) => {
      const exact = clean(`${item.title} ${item.extract}`).toLowerCase().includes(qLower) ? 18 : 0;
      item.score = overlap(query, `${item.title} ${item.extract}`) * 10 + exact + authority(item) + Math.max(0, 14 - item.order);
      if (wantsVideo) item.score += item.mediaType === 'video' ? 55 : -5;
    });

    unique.sort((a, b) => b.score - a.score);
    const out = [];
    const domainCount = new Map();
    for (const item of unique) {
      if (overlap(query, `${item.title} ${item.extract}`) === 0) continue;
      const count = domainCount.get(item.domain) || 0;
      const limit = item.provider === 'YouTube' && wantsVideo ? 7 : 2;
      if (count >= limit) continue;
      domainCount.set(item.domain, count + 1);
      out.push(item);
      if (out.length >= 12) break;
    }
    return out;
  }

  function hash(value) {
    let h = 2166136261;
    const text = String(value || '');
    for (let i = 0; i < text.length; i += 1) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
    return Math.abs(h || 1);
  }

  function pseudoPage(item, index) {
    return {
      pageid: -(hash(`${item.url}|${index}`) + index),
      ns: 0,
      title: item.title,
      extract: item.extract,
      fullurl: item.url,
      provider: item.provider,
      mediaType: item.mediaType,
      thumbnail: item.image ? { source: item.image, width: 1280, height: 720 } : undefined
    };
  }

  function scoreExisting(page, query) {
    const text = `${page.title || ''} ${page.extract || ''}`;
    let score = overlap(query, text) * 9;
    if (clean(text).toLowerCase().includes(clean(query).toLowerCase())) score += 14;
    if (VIDEO_INTENT.test(query) && isVideoUrl(page.fullurl || '')) score += 40;
    return score;
  }

  function mergeNarrow(query, webItems, existingPages) {
    const candidates = [
      ...webItems.map((item, index) => ({ page: pseudoPage(item, index), score: Number(item.score || 0) + 15, domain: item.domain })),
      ...existingPages.map((page) => ({ page, score: scoreExisting(page, query), domain: domainOf(page.fullurl || '') || clean(page.provider, 100).toLowerCase() }))
    ].sort((a, b) => b.score - a.score);

    const seen = new Set();
    const domainCount = new Map();
    const selected = [];
    for (const candidate of candidates) {
      const key = clean(candidate.page.fullurl || `${candidate.page.provider}:${candidate.page.title}`, 1400).toLowerCase();
      if (!key || seen.has(key)) continue;
      const domain = candidate.domain || 'source';
      const count = domainCount.get(domain) || 0;
      const isVideoDomain = domain.includes('youtube.com') || domain === 'youtu.be';
      const cap = VIDEO_INTENT.test(query) && isVideoDomain ? 7 : 2;
      if (count >= cap) continue;
      seen.add(key);
      domainCount.set(domain, count + 1);
      selected.push(candidate.page);
      if (selected.length >= MAX_RESULTS) break;
    }
    return selected;
  }

  async function intelligentFetch(input, init) {
    const rawUrl = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input?.url || '';
    let parsed;
    try { parsed = new URL(rawUrl, location.href); } catch { return upstreamFetch(input, init); }
    const isWikiSearch = parsed.hostname === 'en.wikipedia.org' && parsed.pathname.endsWith('/w/api.php') && parsed.searchParams.get('generator') === 'search';
    if (!isWikiSearch) return upstreamFetch(input, init);

    const query = clean(parsed.searchParams.get('gsrsearch') || '', 500);
    const response = await upstreamFetch(input, init);
    if (!response.ok || !query) return response;

    let data;
    try { data = await response.clone().json(); } catch { return response; }
    const existing = Object.values(data?.query?.pages || {});
    const webItems = await searchPublicWeb(query).catch(() => []);
    if (!webItems.length) return response;

    const merged = mergeNarrow(query, webItems, existing);
    data.query = data.query || {};
    data.query.pages = Object.fromEntries(merged.map((page, index) => [`intelligent_${index}`, page]));
    const headers = new Headers(response.headers);
    headers.delete('content-encoding');
    headers.delete('content-length');
    headers.set('content-type', 'application/json; charset=utf-8');
    return new Response(JSON.stringify(data), { status: response.status, statusText: response.statusText, headers });
  }

  window.fetch = intelligentFetch;

  function captureSourceTitles(root = document) {
    root.querySelectorAll?.('.phi-orange-card').forEach((card) => {
      const heading = card.querySelector('h3');
      if (!heading || card.dataset.realSourceTitle) return;
      const title = clean(heading.textContent, 220);
      if (!title || GENERIC_QUESTION.test(title)) return;
      card.dataset.realSourceTitle = title;
    });
  }

  function restoreSourceTitles() {
    document.querySelectorAll('.phi-orange-card').forEach((card) => {
      const locked = clean(card.dataset.realSourceTitle, 220);
      const heading = card.querySelector('h3');
      const current = clean(heading?.textContent, 220);
      if (!heading || !locked) return;
      if (GENERIC_QUESTION.test(current) || (/\?$/.test(current) && !/\?$/.test(locked))) heading.textContent = locked;
    });
  }

  const startTitleLock = () => {
    captureSourceTitles(document);
    const observer = new MutationObserver((records) => {
      records.forEach((record) => record.addedNodes.forEach((node) => {
        if (node.nodeType === 1) captureSourceTitles(node);
      }));
    });
    if (document.body) observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('infinityphi:gpt-cards-ready', () => queueMicrotask(restoreSourceTitles));
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startTitleLock, { once: true });
  else startTitleLock();

  window.InfinityPhiSearchIntelligence = { searchPublicWeb, mergeNarrow, restoreSourceTitles };
})();
