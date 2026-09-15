(() => {
  'use strict';

  if (!/\/phi(?:\/|$)/.test(location.pathname)) return;

  const priorFetch = window.fetch.bind(window);
  const oldSearch = window.InfinityPhiSearchIntelligence?.searchPublicWeb?.bind(window.InfinityPhiSearchIntelligence);
  const MAX_RESULTS = 18;
  const SPORTS = /\b(baseball|mlb|football|nfl|basketball|nba|wnba|hockey|nhl|soccer|mls|fifa|golf|pga|tennis|bowling|nascar|racing|sports?)\b/i;
  const VIDEO = /\b(video|videos|highlight|highlights|reel|reels|clip|clips|watch|plays|top plays|best plays|recap|footage|tutorial|demo|demonstration)\b/i;
  const SCHEDULE = /\b(schedule|schedules|fixture|fixtures|calendar|matchups?)\b/i;
  const SCORE = /\b(scores?|results?|finals?|box score)\b/i;
  const STANDINGS = /\b(standings?|rankings?|table)\b/i;
  const NEWS = /\b(news|headlines?|updates?|latest|breaking|coverage)\b/i;
  const ROSTER = /\b(roster|lineup|depth chart|squad)\b/i;
  const STATS = /\b(stats?|statistics|leaders?|leaderboard)\b/i;
  const SKIP = new Set(['the','and','for','with','from','about','into','this','that','what','when','where','which','who','why','how','are','was','were','has','have','had','your','you','its','our']);
  const AUTHORITY = new Map([
    ['nfl.com', 24], ['mlb.com', 24], ['nba.com', 22], ['nhl.com', 22],
    ['espn.com', 22], ['foxsports.com', 20], ['cbssports.com', 19], ['nbcsports.com', 18],
    ['youtube.com', 13], ['youtu.be', 13]
  ]);

  const clean = (value, max = 2800) => String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
  const domainOf = (value) => { try { return new URL(value).hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; } };
  const tokens = (value) => [...new Set(clean(value).toLowerCase().match(/[a-z0-9]+/g) || [])].filter((word) => word.length > 2 && !SKIP.has(word));
  const overlap = (query, text) => { const haystack = new Set(tokens(text)); return tokens(query).reduce((score, word) => score + Number(haystack.has(word)), 0); };

  function videoId(url) {
    try {
      const parsed = new URL(url);
      if (parsed.hostname === 'youtu.be') return parsed.pathname.split('/').filter(Boolean)[0] || '';
      if (parsed.hostname.endsWith('youtube.com')) return parsed.searchParams.get('v') || '';
    } catch {}
    return '';
  }

  function providerFor(url) {
    const domain = domainOf(url);
    if (domain === 'youtu.be' || domain.endsWith('youtube.com')) return 'YouTube';
    if (domain === 'nfl.com' || domain.endsWith('.nfl.com')) return 'NFL.com';
    if (domain === 'mlb.com' || domain.endsWith('.mlb.com')) return 'MLB.com';
    if (domain === 'nba.com' || domain.endsWith('.nba.com')) return 'NBA.com';
    if (domain === 'nhl.com' || domain.endsWith('.nhl.com')) return 'NHL.com';
    if (domain === 'espn.com' || domain.endsWith('.espn.com')) return 'ESPN';
    if (domain === 'foxsports.com' || domain.endsWith('.foxsports.com')) return 'FOX Sports';
    if (domain === 'cbssports.com' || domain.endsWith('.cbssports.com')) return 'CBS Sports';
    if (domain === 'nbcsports.com' || domain.endsWith('.nbcsports.com')) return 'NBC Sports';
    return domain || 'Public web';
  }

  function authority(url) {
    const domain = domainOf(url);
    for (const [name, points] of AUTHORITY) {
      if (domain === name || domain.endsWith(`.${name}`)) return points;
    }
    return 0;
  }

  function leagueFor(query) {
    if (/\b(football|nfl)\b/i.test(query)) return 'NFL';
    if (/\b(baseball|mlb)\b/i.test(query)) return 'MLB';
    if (/\b(basketball|nba|wnba)\b/i.test(query)) return /\bwnba\b/i.test(query) ? 'WNBA' : 'NBA';
    if (/\b(hockey|nhl)\b/i.test(query)) return 'NHL';
    if (/\b(soccer|mls)\b/i.test(query)) return 'MLS';
    return '';
  }

  function subjectEquivalent(query, text) {
    const lower = clean(text).toLowerCase();
    if (/\bfootball\b/i.test(query) && /\bnfl\b/i.test(lower)) return true;
    if (/\bbaseball\b/i.test(query) && /\bmlb\b/i.test(lower)) return true;
    if (/\bbasketball\b/i.test(query) && /\b(?:nba|wnba)\b/i.test(lower)) return true;
    if (/\bhockey\b/i.test(query) && /\bnhl\b/i.test(lower)) return true;
    if (/\bsoccer\b/i.test(query) && /\b(?:mls|fifa|uefa)\b/i.test(lower)) return true;
    return false;
  }

  function matchesIntent(query, item) {
    const text = clean(`${item.title} ${item.extract} ${item.url}`).toLowerCase();
    if (SCHEDULE.test(query) && !/\b(schedule|schedules|fixture|fixtures|calendar|matchups?|week\s+\d{1,2}|kickoff|game dates?)\b/i.test(text)) return false;
    if (SCORE.test(query) && !/\b(score|scores|result|results|final|finals|box score)\b/i.test(text)) return false;
    if (STANDINGS.test(query) && !/\b(standings?|rankings?|division|conference|record|table)\b/i.test(text)) return false;
    if (ROSTER.test(query) && !/\b(roster|lineup|depth chart|squad|players?)\b/i.test(text)) return false;
    if (STATS.test(query) && !/\b(stats?|statistics|leaders?|leaderboard|yards?|touchdowns?|goals?|assists?)\b/i.test(text)) return false;
    if (VIDEO.test(query) && item.mediaType !== 'video' && !/\b(highlight|highlights|video|videos|clip|clips|reel|replay|watch)\b/i.test(text)) return false;
    return true;
  }

  function unwrap(raw) {
    const value = clean(raw, 1800);
    try {
      const parsed = new URL(value);
      if (parsed.hostname.endsWith('google.com') && parsed.pathname === '/url' && parsed.searchParams.get('q')) return decodeURIComponent(parsed.searchParams.get('q'));
      if ((parsed.hostname.endsWith('google.com') || parsed.hostname.endsWith('bing.com')) && parsed.searchParams.get('url')) return decodeURIComponent(parsed.searchParams.get('url'));
      return parsed.toString();
    } catch { return ''; }
  }

  function parseResults(text, query, engine) {
    const out = [];
    const seen = new Set();
    const pattern = /\[([^\]\n]{4,260})\]\((https?:\/\/[^)\s]+)\)/g;
    let match;
    let order = 0;
    while ((match = pattern.exec(String(text || ''))) && out.length < 42) {
      const title = clean(match[1], 220);
      const url = unwrap(match[2]);
      const domain = domainOf(url);
      if (!title || !url || !domain || /^(google\.|bing\.|r\.jina\.ai$)/.test(domain) || /\/search(?:\?|$)/.test(url)) continue;
      const key = url.replace(/[?#].*$/, '').toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const id = videoId(url);
      const nearby = clean(String(text || '').slice(pattern.lastIndex, pattern.lastIndex + 520), 420);
      const item = {
        title,
        url,
        domain,
        provider: providerFor(url),
        extract: nearby && (overlap(query, nearby) || subjectEquivalent(query, nearby)) ? nearby : `${title}. ${engine} result matched to “${clean(query, 180)}”.`,
        image: id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : '',
        mediaType: id || domain.endsWith('youtube.com') ? 'video' : 'article',
        order: order++
      };
      if (!matchesIntent(query, item)) continue;
      out.push(item);
    }
    return out;
  }

  async function fetchText(url, ms = 6200) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    try {
      const response = await priorFetch(url, { cache: 'no-store', signal: controller.signal, headers: { Accept: 'text/plain' } });
      if (!response.ok) return '';
      return await response.text();
    } catch { return ''; }
    finally { clearTimeout(timer); }
  }

  function queryVariants(query) {
    const phrases = [query];
    const league = leagueFor(query);
    const year = String(new Date().getFullYear());
    if (SPORTS.test(query)) {
      const subject = league ? `${league} ${query}` : query;
      if (SCHEDULE.test(query)) {
        phrases.push(subject);
        phrases.push(`${subject} ${year} schedule ESPN NFL.com FOX Sports CBS Sports`);
        if (league === 'NFL') phrases.push(`site:nfl.com/schedules ${query}`);
        if (league === 'MLB') phrases.push(`site:mlb.com/schedule ${query}`);
      } else if (NEWS.test(query)) {
        phrases.push(`${subject} ESPN FOX Sports CBS Sports NBC Sports`);
        if (league) phrases.push(`${league} latest news official`);
      } else if (SCORE.test(query) || STANDINGS.test(query) || STATS.test(query) || ROSTER.test(query)) {
        phrases.push(`${subject} ESPN ${league ? `${league}.com` : ''} FOX Sports CBS Sports`);
      } else {
        phrases.push(`${subject} ESPN FOX Sports ${league ? `${league}.com` : ''}`);
      }
    }
    if (VIDEO.test(query)) {
      phrases.unshift(`${query} site:youtube.com/watch`);
      if (league) phrases.push(`${league} ${query} YouTube ESPN FOX Sports`);
    }
    return [...new Set(phrases.map((value) => clean(value, 300)).filter(Boolean))].slice(0, 5);
  }

  async function strongSearch(query) {
    const phrases = queryVariants(query);
    const endpoints = [];
    phrases.forEach((phrase) => {
      const encoded = encodeURIComponent(phrase);
      endpoints.push({ engine: 'Google', url: `https://r.jina.ai/http://www.google.com/search?q=${encoded}` });
      endpoints.push({ engine: 'Bing', url: `https://r.jina.ai/http://www.bing.com/search?q=${encoded}` });
    });

    const tasks = endpoints.map(async (entry) => ({ ...entry, text: await fetchText(entry.url) }));
    if (oldSearch) tasks.push(Promise.resolve({ engine: 'Existing Phi', url: '', items: await oldSearch(query).catch(() => []) }));
    const settled = await Promise.allSettled(tasks);
    const raw = [];
    settled.forEach((result) => {
      if (result.status !== 'fulfilled') return;
      if (Array.isArray(result.value.items)) raw.push(...result.value.items);
      else if (result.value.text) raw.push(...parseResults(result.value.text, query, result.value.engine));
    });

    const seen = new Set();
    const unique = raw.filter((rawItem) => {
      const url = clean(rawItem.url || rawItem.fullurl, 1800);
      const title = clean(rawItem.title, 220);
      if (!url || !title) return false;
      const key = url.replace(/[?#].*$/, '').toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).map((rawItem, index) => {
      const url = clean(rawItem.url || rawItem.fullurl, 1800);
      const id = videoId(url);
      const item = {
        ...rawItem,
        title: clean(rawItem.title, 220),
        url,
        domain: domainOf(url),
        provider: providerFor(url),
        extract: clean(rawItem.extract || rawItem.excerpt || rawItem.sourceExtract, 1600),
        image: clean(rawItem.image || rawItem.imageUrl || rawItem.thumbnail?.source, 1600) || (id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : ''),
        mediaType: rawItem.mediaType || (id || domainOf(url).endsWith('youtube.com') ? 'video' : 'article'),
        order: Number.isFinite(rawItem.order) ? rawItem.order : index,
      };
      return item;
    }).filter((item) => matchesIntent(query, item));

    const wantsVideo = VIDEO.test(query);
    unique.forEach((item) => {
      const relevance = overlap(query, `${item.title} ${item.extract}`) + (subjectEquivalent(query, `${item.title} ${item.extract}`) ? 1 : 0);
      const queryLower = clean(query).toLowerCase();
      const exact = clean(`${item.title} ${item.extract}`).toLowerCase().includes(queryLower) ? 18 : 0;
      item.score = relevance * 13 + exact + authority(item.url) + Math.max(0, 20 - item.order) + (wantsVideo && item.mediaType === 'video' ? 60 : 0);
    });
    unique.sort((a, b) => b.score - a.score);

    const out = [];
    const domainCount = new Map();
    for (const item of unique) {
      const relevance = overlap(query, `${item.title} ${item.extract}`) + (subjectEquivalent(query, `${item.title} ${item.extract}`) ? 1 : 0);
      if (!relevance) continue;
      const count = domainCount.get(item.domain) || 0;
      const youtube = item.provider === 'YouTube';
      const cap = wantsVideo && youtube ? 8 : 3;
      if (count >= cap) continue;
      domainCount.set(item.domain, count + 1);
      out.push(item);
      if (out.length >= MAX_RESULTS) break;
    }
    return out;
  }

  function pseudoPage(item, index) {
    let h = 2166136261;
    const raw = `${item.url}|${index}`;
    for (let i = 0; i < raw.length; i += 1) { h ^= raw.charCodeAt(i); h = Math.imul(h, 16777619); }
    return {
      pageid: -(Math.abs(h || 1) + index),
      ns: 0,
      title: item.title,
      extract: item.extract || `${item.title}. Source-backed web result.`,
      fullurl: item.url,
      provider: item.provider,
      mediaType: item.mediaType,
      thumbnail: item.image ? { source: item.image, width: 1280, height: 720 } : undefined,
    };
  }

  async function finalFetch(input, init) {
    const rawUrl = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input?.url || '';
    let parsed;
    try { parsed = new URL(rawUrl, location.href); } catch { return priorFetch(input, init); }
    const wikiSearch = parsed.hostname === 'en.wikipedia.org' && parsed.pathname.endsWith('/w/api.php') && parsed.searchParams.get('generator') === 'search';
    if (!wikiSearch) return priorFetch(input, init);

    const query = clean(parsed.searchParams.get('gsrsearch') || '', 500);
    const response = await priorFetch(input, init);
    if (!response.ok || !query) return response;
    let data;
    try { data = await response.clone().json(); } catch { return response; }
    const webItems = await strongSearch(query).catch(() => []);
    if (!webItems.length) return response;

    const existing = Object.values(data?.query?.pages || {});
    const combined = [];
    const seen = new Set();
    [...webItems.map(pseudoPage), ...existing].forEach((page) => {
      const key = clean(page.fullurl || `${page.provider}:${page.title}`, 1600).toLowerCase();
      if (!key || seen.has(key)) return;
      seen.add(key);
      combined.push(page);
    });
    data.query = data.query || {};
    data.query.pages = Object.fromEntries(combined.slice(0, MAX_RESULTS).map((page, index) => [`live_${index}`, page]));
    const headers = new Headers(response.headers);
    headers.delete('content-encoding');
    headers.delete('content-length');
    headers.set('content-type', 'application/json; charset=utf-8');
    return new Response(JSON.stringify(data), { status: response.status, statusText: response.statusText, headers });
  }

  window.fetch = finalFetch;
  window.InfinityPhiSearchIntelligence = {
    ...(window.InfinityPhiSearchIntelligence || {}),
    searchPublicWeb: strongSearch,
    queryVariants,
    matchesCurrentIntent: matchesIntent,
    version: '2026-09-15-live2',
  };
})();
