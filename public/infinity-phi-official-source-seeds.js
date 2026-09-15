(() => {
  'use strict';
  if (!/\/phi(?:\/|$)/.test(location.pathname)) return;

  const previousFetch = window.fetch.bind(window);
  const previousPublicSearch = window.InfinityPhiSearchIntelligence?.searchPublicWeb?.bind(window.InfinityPhiSearchIntelligence);
  const clean = (value, max = 2200) => String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
  const VIDEO = /\b(video|videos|highlight|highlights|reel|reels|clip|clips|watch|replay|replays|footage)\b/i;
  const SCHEDULE = /\b(schedule|schedules|fixture|fixtures|calendar|matchups?|tournaments?)\b/i;
  const SCORE = /\b(scores?|results?|finals?|box score)\b/i;
  const STANDINGS = /\b(standings?|rankings?|table|points list)\b/i;
  const NEWS = /\b(news|headlines?|updates?|latest|breaking|coverage)\b/i;

  const LEAGUES = [
    {
      match: /\b(football|nfl)\b/i,
      provider: 'NFL.com',
      schedule: ['NFL Schedules: Games, Times, Matchups & Tickets', 'https://www.nfl.com/schedules', 'Official NFL schedule with games, dates, times, matchups, broadcast information and weekly navigation.'],
      scores: ['NFL Scores and Highlights', 'https://www.nfl.com/scores', 'Official NFL scores, results, game status, replays and highlights.'],
      standings: ['NFL Standings', 'https://www.nfl.com/standings/', 'Official NFL division, conference and league standings.'],
      news: ['NFL News, Analysis & Updates', 'https://www.nfl.com/news/', 'Official NFL news, reports, analysis, schedule stories and league updates.'],
      video: ['NFL Football Highlights, Clips & Analysis', 'https://www.nfl.com/videos/', 'Official NFL video hub with game highlights, clips, analysis, recaps and top plays.'],
      youtube: ['NFL on YouTube', 'https://www.youtube.com/@NFL', 'Official NFL YouTube channel for highlights, clips, recaps, previews and league video.'],
    },
    {
      match: /\b(baseball|mlb)\b/i,
      provider: 'MLB.com',
      schedule: ['MLB Schedule', 'https://www.mlb.com/schedule', 'Official Major League Baseball schedule with games, dates, teams and times.'],
      scores: ['MLB Scores', 'https://www.mlb.com/scores', 'Official Major League Baseball scores and game results.'],
      standings: ['MLB Standings', 'https://www.mlb.com/standings', 'Official Major League Baseball standings.'],
      news: ['MLB News', 'https://www.mlb.com/news', 'Official Major League Baseball news, reports and analysis.'],
      video: ['MLB Video', 'https://www.mlb.com/video', 'Official Major League Baseball video, highlights, clips and recaps.'],
      youtube: ['MLB on YouTube', 'https://www.youtube.com/@MLB', 'Official MLB YouTube channel for highlights, clips and baseball video.'],
    },
    {
      match: /\b(basketball|nba)\b/i,
      provider: 'NBA.com',
      schedule: ['NBA Schedule', 'https://www.nba.com/schedule', 'Official NBA schedule with games, dates, teams and times.'],
      scores: ['NBA Games and Scores', 'https://www.nba.com/games', 'Official NBA games, live scores and results.'],
      standings: ['NBA Standings', 'https://www.nba.com/standings', 'Official NBA conference and league standings.'],
      news: ['NBA News', 'https://www.nba.com/news', 'Official NBA news, reports and analysis.'],
      video: ['NBA Videos', 'https://www.nba.com/watch', 'Official NBA video and watch hub.'],
      youtube: ['NBA on YouTube', 'https://www.youtube.com/@NBA', 'Official NBA YouTube channel for highlights and basketball video.'],
    },
    {
      match: /\b(hockey|nhl)\b/i,
      provider: 'NHL.com',
      schedule: ['NHL Schedule', 'https://www.nhl.com/schedule', 'Official NHL schedule with games, dates, teams and times.'],
      scores: ['NHL Scores', 'https://www.nhl.com/scores', 'Official NHL scores and game results.'],
      standings: ['NHL Standings', 'https://www.nhl.com/standings', 'Official NHL standings.'],
      news: ['NHL News', 'https://www.nhl.com/news', 'Official NHL news, reports and analysis.'],
      video: ['NHL Video', 'https://www.nhl.com/video', 'Official NHL video, highlights and clips.'],
      youtube: ['NHL on YouTube', 'https://www.youtube.com/@NHL', 'Official NHL YouTube channel for highlights and hockey video.'],
    },
    {
      match: /\b(bowling|pba)\b/i,
      provider: 'PBA',
      schedule: ['2026 PBA Tour Schedule', 'https://www.pba.com/schedule/pba-tour', 'Official Professional Bowlers Association tour schedule with tournament dates, locations, qualifying windows and televised finals.'],
      scores: ['PBA National Tour', 'https://www.pba.com/pba-tour/pba-national-tour', 'Official PBA National Tour information, events and tournament results context.'],
      standings: ['PBA National Tour', 'https://www.pba.com/pba-tour/pba-national-tour', 'Official PBA National Tour information and season context.'],
      news: ['Professional Bowlers Association', 'https://www.pba.com/', 'Official PBA source for professional bowling events, tour news, players and coverage.'],
      video: ['PBA Ways to Watch', 'https://www.pba.com/watch', 'Official PBA watch hub with current coverage and YouTube highlights.'],
      youtube: ['PBA Bowling on YouTube', 'https://www.youtube.com/@pbatour', 'Official Professional Bowlers Association YouTube channel with highlights, full telecasts, event previews and finals coverage.'],
    },
  ];

  function sourceFrom(tuple, provider, mediaType = 'article') {
    if (!tuple) return null;
    const [title, url, extract] = tuple;
    const youtube = /youtube\.com/i.test(url);
    return {
      title,
      url,
      fullurl: url,
      provider: youtube ? 'YouTube' : provider,
      domain: (() => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return provider; } })(),
      extract,
      excerpt: extract,
      mediaType: youtube ? 'video' : mediaType,
      image: '',
      sourceTitle: title,
      sourceExtract: extract,
      officialSeed: true,
      score: 100,
    };
  }

  function officialSources(query) {
    const league = LEAGUES.find((item) => item.match.test(query));
    if (!league) return [];
    const out = [];
    if (SCHEDULE.test(query)) out.push(sourceFrom(league.schedule, league.provider));
    if (SCORE.test(query)) out.push(sourceFrom(league.scores, league.provider));
    if (STANDINGS.test(query)) out.push(sourceFrom(league.standings, league.provider));
    if (NEWS.test(query)) out.push(sourceFrom(league.news, league.provider));
    if (VIDEO.test(query)) out.push(sourceFrom(league.video, league.provider, 'video'), sourceFrom(league.youtube, league.provider, 'video'));
    if (!out.length) out.push(sourceFrom(league.news, league.provider), sourceFrom(league.schedule, league.provider));
    return out.filter(Boolean);
  }

  function dedupe(items) {
    const seen = new Set();
    return items.filter((item) => {
      const key = clean(item?.url || item?.fullurl || `${item?.provider}:${item?.title}`, 1600).toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function pseudoPage(source, index) {
    let hash = 2166136261;
    const raw = `${source.url}|official|${index}`;
    for (let i = 0; i < raw.length; i += 1) { hash ^= raw.charCodeAt(i); hash = Math.imul(hash, 16777619); }
    return {
      pageid: -(Math.abs(hash || 1) + index),
      ns: 0,
      title: source.title,
      extract: source.extract,
      fullurl: source.url,
      provider: source.provider,
      mediaType: source.mediaType,
    };
  }

  async function seededFetch(input, init) {
    const rawUrl = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input?.url || '';
    let parsed;
    try { parsed = new URL(rawUrl, location.href); } catch { return previousFetch(input, init); }
    const wikiSearch = parsed.hostname === 'en.wikipedia.org' && parsed.pathname.endsWith('/w/api.php') && parsed.searchParams.get('generator') === 'search';
    if (!wikiSearch) return previousFetch(input, init);
    const query = clean(parsed.searchParams.get('gsrsearch') || '', 500);
    const seeds = officialSources(query);
    const response = await previousFetch(input, init);
    if (!response.ok || !seeds.length) return response;
    let data;
    try { data = await response.clone().json(); } catch { return response; }
    const existing = Object.values(data?.query?.pages || {});
    const pages = dedupe([...seeds.map(pseudoPage), ...existing.map((page) => ({ ...page, url: page.fullurl }))]);
    data.query = data.query || {};
    data.query.pages = Object.fromEntries(pages.slice(0, 20).map((page, index) => [`official_${index}`, page.fullurl ? page : pseudoPage(page, index)]));
    const headers = new Headers(response.headers);
    headers.delete('content-encoding');
    headers.delete('content-length');
    headers.set('content-type', 'application/json; charset=utf-8');
    return new Response(JSON.stringify(data), { status: response.status, statusText: response.statusText, headers });
  }

  window.fetch = seededFetch;

  if (previousPublicSearch) {
    window.InfinityPhiSearchIntelligence = {
      ...(window.InfinityPhiSearchIntelligence || {}),
      searchPublicWeb: async (query) => dedupe([...officialSources(query), ...(await previousPublicSearch(query).catch(() => []))]),
      officialSources,
      version: '2026-09-15-official-floor2',
    };
  }
})();