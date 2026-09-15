(() => {
  'use strict';

  const MAX_CARDS = 14;
  const VIDEO_INTENT = /\b(video|videos|highlight|highlights|reel|reels|clip|clips|watch|plays|top plays|best plays|recap|footage|tutorial|demo|demonstration)\b/i;
  const SPORTS = /\b(baseball|mlb|football|nfl|basketball|nba|wnba|hockey|nhl|soccer|mls|fifa|golf|pga|tennis|bowling|nascar|racing|sports?)\b/i;
  const GENERIC = /^(?:what does (?:this|the) evidence show|when did .+ become important|where did .+ begin|who was involved in|how did .+ begin|a closer look at)\b/i;
  const AUTHORITY = new Map([
    ['mlb.com', 18], ['espn.com', 16], ['foxsports.com', 16], ['cbssports.com', 12], ['nbcsports.com', 12],
    ['youtube.com', 8], ['youtu.be', 8]
  ]);
  const SKIP = new Set(['the','and','for','with','from','about','into','this','that','what','when','where','which','who','why','how','are','was','were','has','have','had','your','you','its','our']);
  let busy = false;
  let timer = 0;
  let lastQuery = '';
  let lastItems = [];
  let pendingShare = null;

  const clean = (value, max = 3000) => String(value || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
  const domainOf = (value) => { try { return new URL(value).hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; } };
  const tokens = (value) => [...new Set(clean(value).toLowerCase().match(/[a-z0-9]+/g) || [])].filter((word) => word.length > 2 && !SKIP.has(word));
  const overlap = (query, text) => { const set = new Set(tokens(text)); return tokens(query).reduce((n, word) => n + Number(set.has(word)), 0); };

  function queryText() {
    try { return clean(new URLSearchParams(location.search).get('q') || document.querySelector('.phi-search-box input')?.value || document.querySelector('.phi-identity')?.textContent || '', 500); }
    catch { return ''; }
  }

  function cardNodes() { return [...document.querySelectorAll('.phi-orange-card')].slice(0, MAX_CARDS); }

  function providerFor(item) {
    const domain = domainOf(item.url);
    if (domain === 'youtu.be' || domain.endsWith('youtube.com')) return 'YouTube';
    if (domain === 'mlb.com' || domain.endsWith('.mlb.com')) return 'MLB.com';
    if (domain === 'espn.com' || domain.endsWith('.espn.com')) return 'ESPN';
    if (domain === 'foxsports.com' || domain.endsWith('.foxsports.com')) return 'FOX Sports';
    return clean(item.provider, 100) || domain || 'Original source';
  }

  function videoId(url) {
    try {
      const u = new URL(url);
      if (u.hostname === 'youtu.be') return u.pathname.split('/').filter(Boolean)[0] || '';
      if (u.hostname.endsWith('youtube.com')) return u.searchParams.get('v') || '';
    } catch {}
    return '';
  }

  function normalize(item) {
    if (!item) return null;
    const url = clean(item.url || item.fullurl, 1600);
    const title = clean(item.title || item.sourceTitle, 240);
    if (!url || !title) return null;
    const domain = domainOf(url);
    const id = videoId(url);
    const mediaType = item.mediaType || (id || domain.endsWith('youtube.com') || /\/(video|videos|watch|clips?)\b/i.test(url) ? 'video' : 'article');
    return {
      title,
      url,
      domain,
      provider: providerFor({ ...item, url }),
      excerpt: clean(item.extract || item.excerpt || item.sourceExtract, 1200),
      image: clean(item.image || item.imageUrl || item.thumbnail?.source, 1600) || (id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : ''),
      mediaType,
      score: Number(item.score || 0)
    };
  }

  function authorityScore(item, query) {
    if (!SPORTS.test(query)) return 0;
    for (const [domain, points] of AUTHORITY) {
      if (item.domain === domain || item.domain.endsWith(`.${domain}`)) return points;
    }
    return 0;
  }

  function rankItems(query, rawItems) {
    const wantsVideo = VIDEO_INTENT.test(query);
    const seen = new Set();
    const ranked = rawItems.map(normalize).filter(Boolean).filter((item) => {
      const key = item.url.replace(/[?#].*$/, '').toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return overlap(query, `${item.title} ${item.excerpt}`) > 0;
    });
    ranked.forEach((item, index) => {
      item.rank = overlap(query, `${item.title} ${item.excerpt}`) * 12 + authorityScore(item, query) + Math.max(0, 18 - index);
      if (wantsVideo) item.rank += item.mediaType === 'video' ? 65 : -8;
    });
    ranked.sort((a, b) => b.rank - a.rank);

    const selected = [];
    const domains = new Map();
    for (const item of ranked) {
      const count = domains.get(item.domain) || 0;
      const isYouTube = item.domain === 'youtu.be' || item.domain.endsWith('youtube.com');
      const cap = wantsVideo && isYouTube ? 7 : 2;
      if (count >= cap) continue;
      domains.set(item.domain, count + 1);
      selected.push(item);
      if (selected.length >= MAX_CARDS) break;
    }
    return selected;
  }

  async function enrichTop(query, items) {
    const readArticle = window.InfinityPhiMultiSource?.readArticle;
    if (typeof readArticle !== 'function') return items;
    const enriched = await Promise.all(items.map(async (item, index) => {
      if (item.mediaType === 'video' || item.excerpt.length >= 140 || index >= 5) return item;
      try {
        const text = clean(await readArticle(item.url), 3600);
        if (!text) return item;
        const sentences = text.split(/(?<=[.!?])\s+/).filter((line) => line.length > 50 && overlap(query, line) > 0).slice(0, 2);
        return { ...item, excerpt: clean(sentences.join(' '), 900) || item.excerpt };
      } catch { return item; }
    }));
    return enriched;
  }

  async function discover(query) {
    const publicSearch = window.InfinityPhiSearchIntelligence?.searchPublicWeb;
    const gdelt = window.InfinityPhiMultiSource?.gdelt;
    const batches = await Promise.allSettled([
      typeof publicSearch === 'function' ? publicSearch(query) : Promise.resolve([]),
      typeof gdelt === 'function' ? gdelt(query) : Promise.resolve([])
    ]);
    const raw = batches.flatMap((batch) => batch.status === 'fulfilled' && Array.isArray(batch.value) ? batch.value : []);
    return enrichTop(query, rankItems(query, raw));
  }

  function installStyles() {
    if (document.getElementById('infinityPhiMediaV2Style')) return;
    const style = document.createElement('style');
    style.id = 'infinityPhiMediaV2Style';
    style.textContent = `
      .phi-media-v2-play{position:absolute;left:14px;top:14px;z-index:4;display:flex;align-items:center;justify-content:center;width:44px;height:44px;border-radius:999px;background:rgba(4,8,12,.86);border:1px solid rgba(255,255,255,.82);color:#fff;font-size:1.05rem;box-shadow:0 5px 18px rgba(0,0,0,.35);pointer-events:none}
      .phi-media-v2-chip{display:inline-flex!important;align-items:center;margin-top:7px;padding:4px 7px;border-radius:999px;background:rgba(0,0,0,.16);font-size:.69rem!important;font-weight:850!important}
      .phi-media-v2-source{display:flex!important;align-items:center;justify-content:center;min-height:42px;padding:9px 10px!important;border-radius:11px!important;font-size:.78rem!important;font-weight:850!important;text-align:center}
    `;
    document.head.appendChild(style);
  }

  function fallbackBody(item) {
    return item.mediaType === 'video'
      ? `${item.provider} video matched to this search. Open the original video for the full highlight, reel, demonstration, or footage.`
      : `${item.provider} source matched to this search. Open the original story or page for the full source.`;
  }

  function setImage(card, item) {
    if (!item.image) return;
    const main = card.querySelector('.phi-orange-main');
    if (!main) return;
    let img = main.querySelector('img');
    if (!img) {
      img = document.createElement('img');
      img.loading = 'lazy';
      main.prepend(img);
      main.querySelector('.phi-orange-image-fallback')?.remove();
    }
    if (img.src !== item.image) img.src = item.image;
    img.alt = item.title;
    card.dataset.phiMediaImage = item.image;
  }

  function setPlay(card, enabled) {
    const main = card.querySelector('.phi-orange-main');
    if (!main) return;
    let badge = main.querySelector('.phi-media-v2-play');
    if (!enabled) { badge?.remove(); return; }
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'phi-media-v2-play';
      badge.setAttribute('aria-hidden', 'true');
      badge.textContent = '▶';
      main.appendChild(badge);
    }
  }

  function setSourceUI(card, item) {
    const copy = card.querySelector('.phi-orange-copy');
    if (copy) {
      let chip = copy.querySelector('.phi-media-v2-chip');
      if (!chip) { chip = document.createElement('span'); chip.className = 'phi-media-v2-chip'; copy.appendChild(chip); }
      chip.textContent = `${item.mediaType === 'video' ? '▶ Video' : 'Source'} · ${item.provider}`;
    }
    const actions = card.querySelector('.phi-orange-actions');
    if (actions) {
      let button = actions.querySelector('.phi-media-v2-source');
      if (!button) {
        button = document.createElement('button');
        button.type = 'button';
        button.className = 'phi-card-tool phi-media-v2-source';
        button.addEventListener('click', (event) => {
          event.preventDefault(); event.stopPropagation();
          if (button.dataset.url) window.open(button.dataset.url, '_blank', 'noopener,noreferrer');
        });
        actions.appendChild(button);
      }
      button.dataset.url = item.url;
      button.textContent = `${item.mediaType === 'video' ? 'Watch video' : 'Open source'} · ${item.provider}`;
    }
  }

  function rewrite(card, item) {
    if (!card || !item) return;
    if (card.dataset.phiMediaUrl === item.url && card.dataset.phiMediaV2 === '1') return;
    const heading = card.querySelector('h3');
    const paragraph = card.querySelector('.phi-orange-copy p') || card.querySelector('p');
    const label = card.querySelector('.phi-orange-copy small');
    if (!heading || !paragraph) return;
    heading.textContent = item.title;
    paragraph.textContent = item.excerpt || fallbackBody(item);
    if (label) label.textContent = `${item.mediaType === 'video' ? 'Video result' : 'Source result'} · ${item.provider}`;
    card.dataset.gptTitle = item.title;
    card.dataset.gptBody = paragraph.textContent;
    card.dataset.realSourceTitle = item.title;
    card.dataset.phiMediaUrl = item.url;
    card.dataset.phiMediaProvider = item.provider;
    card.dataset.phiMediaType = item.mediaType;
    card.dataset.phiMediaSourceBacked = '1';
    card.dataset.phiMediaV2 = '1';
    setImage(card, item);
    setSourceUI(card, item);
    setPlay(card, item.mediaType === 'video');
  }

  function repairUnbackedGeneric(cards) {
    cards.forEach((card) => {
      if (card.dataset.phiMediaSourceBacked === '1') return;
      const heading = card.querySelector('h3');
      if (!heading || !GENERIC.test(clean(heading.textContent))) return;
      const locked = clean(card.dataset.realSourceTitle, 220);
      if (locked) heading.textContent = locked;
    });
  }

  function injectGreen(items) {
    const grid = document.querySelector('.phi-green-grid');
    if (!grid) return;
    const existing = new Set([...grid.querySelectorAll('a[href]')].map((node) => clean(node.href).toLowerCase()));
    items.slice(0, 12).forEach((item) => {
      if (existing.has(item.url.toLowerCase())) return;
      const a = document.createElement('a');
      a.href = item.url; a.target = '_blank'; a.rel = 'noreferrer'; a.className = 'phi-green-card';
      if (item.image) { const img = document.createElement('img'); img.src = item.image; img.alt = ''; a.appendChild(img); }
      const wrap = document.createElement('div');
      const small = document.createElement('small'); small.textContent = `${item.mediaType === 'video' ? 'VIDEO · ' : ''}${item.provider}`;
      const b = document.createElement('b'); b.textContent = item.title;
      const p = document.createElement('p'); p.textContent = item.excerpt || fallbackBody(item);
      wrap.append(small, b, p); a.appendChild(wrap); grid.appendChild(a); existing.add(item.url.toLowerCase());
    });
  }

  function apply(items, query) {
    const cards = cardNodes();
    if (!cards.length) return;
    installStyles();
    cards.slice(0, Math.min(cards.length, items.length)).forEach((card, index) => rewrite(card, items[index]));
    repairUnbackedGeneric(cards);
    injectGreen(items);
    window.dispatchEvent(new CustomEvent('infinityphi:media-cards-ready', { detail: { query, count: items.length, version: 2 } }));
  }

  async function refresh() {
    if (!/\/phi(?:\/|$)/.test(location.pathname) || busy) return;
    const query = queryText();
    const cards = cardNodes();
    if (!query || !cards.length) return;
    if (query === lastQuery && lastItems.length) { apply(lastItems, query); return; }
    busy = true;
    try {
      lastItems = await discover(query);
      lastQuery = query;
      if (lastItems.length) apply(lastItems, query);
      else repairUnbackedGeneric(cards);
    } finally { busy = false; }
  }

  function schedule() { clearTimeout(timer); timer = setTimeout(() => void refresh(), 260); }

  function shareData(card) {
    if (!card) return null;
    return {
      title: clean(card.dataset.gptTitle || card.querySelector('h3')?.textContent, 220),
      body: clean(card.dataset.gptBody || card.querySelector('.phi-orange-copy p')?.textContent || card.querySelector('p')?.textContent, 1400),
      source: clean(card.dataset.phiMediaUrl, 1600),
      image: clean(card.dataset.phiMediaImage || card.querySelector('.phi-orange-main img')?.src, 1600),
      at: Date.now()
    };
  }

  document.addEventListener('click', (event) => {
    const share = event.target?.closest?.('.phi-share-card');
    if (share) pendingShare = shareData(share.closest('.phi-orange-card'));
  }, true);

  function installShareBridge() {
    if (typeof navigator.share !== 'function' || navigator.share.__infinityPhiMediaV2) return;
    const previous = navigator.share.bind(navigator);
    const wrapped = async (data = {}) => {
      const current = pendingShare && Date.now() - pendingShare.at < 2500 ? pendingShare : null;
      pendingShare = null;
      if (!current) return previous(data);
      let url = data.url;
      try {
        const parsed = new URL(String(data.url || ''), location.href);
        if (/\/phi(?:\/|$)/.test(parsed.pathname)) {
          if (current.title) parsed.searchParams.set('cardTitle', current.title);
          if (current.body) parsed.searchParams.set('cardBody', current.body);
          if (current.source) parsed.searchParams.set('source', current.source);
          if (current.image) parsed.searchParams.set('image', current.image);
          url = parsed.toString();
        }
      } catch {}
      return previous({ ...data, title: current.title || data.title, text: current.body?.slice(0, 420) || data.text, url });
    };
    wrapped.__infinityPhiMediaV2 = true;
    try { Object.defineProperty(navigator, 'share', { configurable: true, value: wrapped }); }
    catch { try { navigator.share = wrapped; } catch {} }
  }

  if (!/\/phi(?:\/|$)/.test(location.pathname)) return;
  installStyles();
  installShareBridge();
  window.addEventListener('infinityphi:gpt-cards-ready', schedule);
  window.addEventListener('infinityphi:research-refined', () => { lastQuery = ''; schedule(); });
  window.addEventListener('popstate', () => { lastQuery = ''; schedule(); });
  const start = () => {
    schedule();
    if (!document.body) return;
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true }); else start();

  window.InfinityPhiMediaCards = { refresh, discover, rankItems, version: 2 };
})();
