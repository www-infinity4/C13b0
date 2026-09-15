(() => {
  'use strict';

  const MAX_CARDS = 18;
  const CACHE_PREFIX = 'infinityPhiOfficialMedia:v1:';
  const SPORTS = /\b(baseball|mlb|major league|world series|home run|pitcher|pitching|batter|batting|inning|innings|yankees|dodgers|cubs|cardinals|mets|braves|red sox|white sox|astros|phillies|padres|giants|rangers|tigers|twins|guardians|pirates|orioles|rays|athletics|mariners|brewers|rockies|royals|nationals|angels|marlins|reds|diamondbacks|blue jays)\b/i;
  const VIDEO = /\b(video|videos|highlight|highlights|recap|watch|clip|clips|top plays|best plays)\b/i;
  const WEIRD_TITLE = /^(what does (?:this|the) evidence show about|a closer look at)\b/i;
  const PROVIDERS = [
    { domain: 'mlb.com', name: 'MLB.com', weight: 8 },
    { domain: 'espn.com', name: 'ESPN', weight: 7 },
    { domain: 'foxsports.com', name: 'FOX Sports', weight: 7 },
    { domain: 'cbssports.com', name: 'CBS Sports', weight: 5 },
    { domain: 'nbcsports.com', name: 'NBC Sports', weight: 5 },
  ];

  let busy = false;
  let timer = 0;
  let lastQuery = '';
  let officialItems = [];
  let pendingShare = null;

  const clean = (value, max = 4000) => String(value || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
  const lower = (value) => clean(value).toLowerCase();
  const sourceDomain = (value) => {
    try { return new URL(value).hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; }
  };
  const queryText = () => {
    try {
      return clean(new URLSearchParams(location.search).get('q') || document.querySelector('.phi-search-box input')?.value || document.querySelector('.phi-identity')?.textContent || '', 500);
    } catch { return ''; }
  };
  const cardNodes = () => [...document.querySelectorAll('.phi-orange-card')].slice(0, MAX_CARDS);

  function tokens(value) {
    return lower(value).replace(/https?:\/\/\S+/g, ' ').replace(/[^a-z0-9]+/g, ' ').split(/\s+/)
      .filter((word) => word.length > 2 && !['the','and','for','with','from','into','about','this','that','what','when','where','which','who','why','how','are','was','were','has','have','had'].includes(word));
  }

  function overlap(a, b) {
    const left = new Set(tokens(a));
    const right = new Set(tokens(b));
    let hit = 0;
    left.forEach((word) => { if (right.has(word)) hit += 1; });
    return hit;
  }

  function providerFor(url, fallback = '') {
    const domain = sourceDomain(url);
    const known = PROVIDERS.find((item) => domain === item.domain || domain.endsWith(`.${item.domain}`));
    return known?.name || clean(fallback, 120) || domain || 'Original source';
  }

  function mediaTypeFor(title, url) {
    const text = `${title} ${url}`;
    if (/\/(video|videos|watch|watch-vertical|film-room)\b/i.test(url) || VIDEO.test(text)) return 'video';
    return 'article';
  }

  function readableDate(raw) {
    const digits = String(raw || '').replace(/[^0-9]/g, '').slice(0, 8);
    if (digits.length !== 8) return '';
    const year = Number(digits.slice(0, 4));
    const month = Number(digits.slice(4, 6));
    const day = Number(digits.slice(6, 8));
    const date = new Date(Date.UTC(year, month - 1, day));
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(date);
  }

  async function fetchJson(url, ms = 3000) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ms);
    try {
      const response = await fetch(url, { cache: 'no-store', signal: controller.signal });
      if (!response.ok) return null;
      return await response.json();
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  async function gdeltProviderSearch(query, provider) {
    const url = new URL('https://api.gdeltproject.org/api/v2/doc/doc');
    const q = `${query} domain:${provider.domain}`;
    url.search = new URLSearchParams({ query: q, mode: 'artlist', maxrecords: '18', format: 'json', sort: 'HybridRel' }).toString();
    const data = await fetchJson(url, 3200);
    return (data?.articles || []).flatMap((article) => {
      const target = clean(article.url, 1400);
      const title = clean(article.title, 260);
      if (!target || !title) return [];
      const domain = sourceDomain(target);
      if (!(domain === provider.domain || domain.endsWith(`.${provider.domain}`))) return [];
      const mediaType = mediaTypeFor(title, target);
      return [{
        title,
        url: target,
        provider: provider.name,
        domain,
        image: clean(article.socialimage, 1400),
        seenDate: readableDate(article.seendate),
        mediaType,
        weight: provider.weight + (mediaType === 'video' ? 5 : 0) + overlap(query, title) * 2,
      }];
    });
  }

  function meaningfulExcerpt(text, item, query) {
    const sentences = clean(text, 6000).split(/(?<=[.!?])\s+/).map((line) => clean(line, 700)).filter((line) => line.length >= 55 && line.length <= 700);
    const bad = /cookie|privacy policy|sign in|subscribe|navigation|advertisement|javascript|all rights reserved|terms of use/i;
    const ranked = sentences
      .filter((line) => !bad.test(line))
      .map((line) => ({ line, score: overlap(line, `${query} ${item.title}`) }))
      .sort((a, b) => b.score - a.score || a.line.length - b.line.length);
    const selected = [];
    for (const candidate of ranked) {
      if (!candidate.score && selected.length) continue;
      if (selected.some((line) => lower(line) === lower(candidate.line))) continue;
      selected.push(candidate.line);
      if (selected.length >= 2) break;
    }
    return clean(selected.join(' '), 900);
  }

  async function enrich(items, query) {
    const reader = window.InfinityPhiMultiSource?.readArticle;
    if (typeof reader !== 'function') return items;
    const enriched = await Promise.all(items.map(async (item, index) => {
      if (index >= 8) return item;
      try {
        const text = await reader(item.url);
        const excerpt = meaningfulExcerpt(text, item, query);
        return { ...item, excerpt };
      } catch {
        return item;
      }
    }));
    return enriched;
  }

  function fallbackBody(item) {
    const date = item.seenDate ? ` · ${item.seenDate}` : '';
    if (item.mediaType === 'video') return `${item.provider}${date}. Open the original video source for the highlight, recap, and related coverage.`;
    return `${item.provider}${date}. Open the original source for the full report and related coverage.`;
  }

  function cacheKey(query) {
    return `${CACHE_PREFIX}${lower(query)}`;
  }

  function readCache(query) {
    try {
      const cached = JSON.parse(sessionStorage.getItem(cacheKey(query)) || 'null');
      if (!cached || Date.now() - Number(cached.at || 0) > 10 * 60 * 1000 || !Array.isArray(cached.items)) return [];
      return cached.items;
    } catch { return []; }
  }

  function writeCache(query, items) {
    try { sessionStorage.setItem(cacheKey(query), JSON.stringify({ at: Date.now(), items })); } catch {}
  }

  async function officialSportsSources(query) {
    const cached = readCache(query);
    if (cached.length) return cached;
    const results = await Promise.allSettled(PROVIDERS.map((provider) => gdeltProviderSearch(query, provider)));
    const seen = new Set();
    let items = results.flatMap((result) => result.status === 'fulfilled' ? result.value : [])
      .filter((item) => {
        const key = lower(item.url);
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => b.weight - a.weight);
    if (VIDEO.test(query) && items.some((item) => item.mediaType === 'video')) {
      items.sort((a, b) => Number(b.mediaType === 'video') - Number(a.mediaType === 'video') || b.weight - a.weight);
    }
    items = await enrich(items.slice(0, 20), query);
    writeCache(query, items);
    return items;
  }

  function renderedSources() {
    return [...document.querySelectorAll('.phi-green-card[href]')].flatMap((node) => {
      const url = node.href || '';
      if (!url || url === location.href || url.endsWith('#')) return [];
      return [{
        title: clean(node.querySelector('b')?.textContent, 260),
        excerpt: clean(node.querySelector('p')?.textContent, 1400),
        provider: providerFor(url, node.querySelector('small')?.textContent),
        url,
        image: node.querySelector('img')?.src || '',
        mediaType: mediaTypeFor(node.querySelector('b')?.textContent || '', url),
      }];
    });
  }

  function bestRenderedSource(card) {
    const heading = clean(card.querySelector('h3')?.textContent, 240);
    const body = clean(card.querySelector('.phi-orange-copy p')?.textContent || card.querySelector('p')?.textContent, 1400);
    return renderedSources().sort((a, b) => overlap(`${heading} ${body}`, `${b.title} ${b.excerpt}`) - overlap(`${heading} ${body}`, `${a.title} ${a.excerpt}`))[0] || null;
  }

  function installStyles() {
    if (document.getElementById('infinityPhiMediaCardStyle')) return;
    const style = document.createElement('style');
    style.id = 'infinityPhiMediaCardStyle';
    style.textContent = `
      .phi-orange-main{position:relative}
      .phi-media-play{position:absolute;left:14px;top:14px;z-index:3;display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;border-radius:999px;background:rgba(5,10,16,.86);border:1px solid rgba(255,255,255,.8);color:#fff;font-size:1.05rem;box-shadow:0 5px 18px rgba(0,0,0,.35);pointer-events:none}
      .phi-media-source-chip{display:inline-flex!important;align-items:center;gap:6px;margin-top:7px;padding:4px 7px;border-radius:999px;background:rgba(0,0,0,.16);font-size:.69rem!important;font-weight:850!important;letter-spacing:.02em}
      .phi-media-source-button{grid-column:auto;display:flex!important;align-items:center;justify-content:center;min-height:42px;padding:9px 10px!important;border-radius:11px!important;font-size:.78rem!important;font-weight:850!important;text-align:center;line-height:1.15}
      .phi-green-card.phi-media-added-source{outline:1px solid rgba(255,255,255,.12)}
    `;
    document.head.appendChild(style);
  }

  function addSourceChip(card, item) {
    const copy = card.querySelector('.phi-orange-copy');
    if (!copy) return;
    let chip = copy.querySelector('.phi-media-source-chip');
    if (!chip) {
      chip = document.createElement('span');
      chip.className = 'phi-media-source-chip';
      copy.appendChild(chip);
    }
    chip.textContent = `${item.mediaType === 'video' ? '▶ Video' : 'Source'} · ${item.provider}`;
  }

  function addSourceButton(card, item) {
    const actions = card.querySelector('.phi-orange-actions');
    if (!actions) return;
    let button = actions.querySelector('.phi-media-source-button');
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.className = 'phi-card-tool phi-media-source-button';
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const target = button.dataset.url;
        if (target) window.open(target, '_blank', 'noopener,noreferrer');
      });
      actions.appendChild(button);
    }
    button.dataset.url = item.url;
    button.textContent = `${item.mediaType === 'video' ? 'Watch video' : 'Open source'} · ${item.provider}`;
  }

  function setPlayBadge(card, enabled) {
    const main = card.querySelector('.phi-orange-main');
    if (!main) return;
    let badge = main.querySelector('.phi-media-play');
    if (!enabled) { badge?.remove(); return; }
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'phi-media-play';
      badge.setAttribute('aria-hidden', 'true');
      badge.textContent = '▶';
      main.appendChild(badge);
    }
  }

  function assignImage(card, item, usedImages, fallbackImages) {
    let chosen = clean(item?.image, 1400);
    if (chosen && usedImages.has(chosen)) chosen = '';
    if (!chosen) chosen = fallbackImages.find((candidate) => candidate && !usedImages.has(candidate)) || '';
    const current = card.querySelector('.phi-orange-main img');
    if (chosen) {
      usedImages.add(chosen);
      if (current) {
        current.src = chosen;
        current.alt = item?.title || current.alt || 'Source image';
      } else {
        const fallback = card.querySelector('.phi-orange-image-fallback');
        const img = document.createElement('img');
        img.src = chosen;
        img.alt = item?.title || 'Source image';
        img.loading = 'lazy';
        if (fallback) fallback.replaceWith(img);
        else card.querySelector('.phi-orange-main')?.prepend(img);
      }
      card.dataset.phiMediaImage = chosen;
      return;
    }

    if (current?.src && !usedImages.has(current.src)) {
      usedImages.add(current.src);
      card.dataset.phiMediaImage = current.src;
      return;
    }

    if (current?.src && usedImages.has(current.src)) {
      const fallback = document.createElement('div');
      fallback.className = 'phi-orange-image-fallback';
      fallback.textContent = 'φ';
      current.replaceWith(fallback);
      card.dataset.phiMediaImage = '';
    }
  }

  function rewriteWithOfficialSource(card, item, usedImages, fallbackImages) {
    if (card.dataset.phiMediaSourceBacked === '1' && card.dataset.phiMediaUrl === item.url) {
      const existingImage = clean(card.dataset.phiMediaImage || card.querySelector('.phi-orange-main img')?.src, 1400);
      if (existingImage) usedImages.add(existingImage);
      return;
    }

    const heading = card.querySelector('h3');
    const paragraph = card.querySelector('.phi-orange-copy p') || card.querySelector('p');
    const label = card.querySelector('.phi-orange-copy small');
    if (!heading || !paragraph) return;

    const title = clean(item.title, 180);
    const body = clean(item.excerpt || fallbackBody(item), 900);
    heading.textContent = title;
    paragraph.textContent = body;
    if (label) label.textContent = `${item.mediaType === 'video' ? 'Video card' : 'Source card'} · ${item.provider}`;

    card.dataset.gptCard = '1';
    card.dataset.gptTitle = title;
    card.dataset.gptBody = body;
    card.dataset.phiMediaUrl = item.url;
    card.dataset.phiMediaProvider = item.provider;
    card.dataset.phiMediaType = item.mediaType;
    card.dataset.phiMediaSourceBacked = '1';

    assignImage(card, item, usedImages, fallbackImages);
    addSourceChip(card, item);
    addSourceButton(card, item);
    setPlayBadge(card, item.mediaType === 'video');
  }

  function repairGenericWeirdTitles(cards) {
    cards.forEach((card) => {
      if (card.dataset.phiMediaSourceBacked === '1') return;
      const heading = card.querySelector('h3');
      if (!heading || !WEIRD_TITLE.test(clean(heading.textContent))) return;
      const source = bestRenderedSource(card);
      const sourceTitle = clean(source?.title, 180);
      if (!sourceTitle) return;
      heading.textContent = sourceTitle;
      card.dataset.gptTitle = sourceTitle;
      if (source?.url) {
        card.dataset.phiMediaUrl = source.url;
        card.dataset.phiMediaProvider = source.provider;
        card.dataset.phiMediaType = source.mediaType;
        addSourceChip(card, source);
        addSourceButton(card, source);
        setPlayBadge(card, source.mediaType === 'video');
      }
    });
  }

  function dedupeImages(cards) {
    const sourceImages = renderedSources().map((source) => source.image).filter(Boolean);
    const used = new Set();
    cards.forEach((card) => {
      const img = card.querySelector('.phi-orange-main img');
      if (!img?.src) return;
      if (!used.has(img.src)) { used.add(img.src); return; }
      const replacement = sourceImages.find((candidate) => candidate && !used.has(candidate));
      if (replacement) {
        img.src = replacement;
        used.add(replacement);
        card.dataset.phiMediaImage = replacement;
      }
    });
  }

  function injectGreenSources(items) {
    const grid = document.querySelector('.phi-green-grid');
    if (!grid) return;
    const existing = new Set([...grid.querySelectorAll('a[href]')].map((node) => lower(node.href)));
    items.slice(0, 10).forEach((item) => {
      if (!item.url || existing.has(lower(item.url))) return;
      const anchor = document.createElement('a');
      anchor.href = item.url;
      anchor.target = '_blank';
      anchor.rel = 'noreferrer';
      anchor.className = 'phi-green-card phi-media-added-source';
      if (item.image) {
        const img = document.createElement('img');
        img.src = item.image;
        img.alt = '';
        anchor.appendChild(img);
      }
      const text = document.createElement('div');
      const small = document.createElement('small');
      small.textContent = `${item.mediaType === 'video' ? 'VIDEO · ' : ''}${item.provider}`;
      const title = document.createElement('b');
      title.textContent = item.title;
      const body = document.createElement('p');
      body.textContent = item.excerpt || fallbackBody(item);
      text.append(small, title, body);
      anchor.appendChild(text);
      grid.appendChild(anchor);
      existing.add(lower(item.url));
    });
  }

  function applyOfficialItems(items, query) {
    const cards = cardNodes();
    if (!cards.length) return;
    installStyles();

    if (SPORTS.test(query) && items.length) {
      const fallbackImages = [
        ...items.map((item) => item.image),
        ...renderedSources().map((source) => source.image),
      ].filter(Boolean);
      const usedImages = new Set();
      const desiredVideo = VIDEO.test(query);
      const ranked = [...items].sort((a, b) =>
        (desiredVideo ? Number(b.mediaType === 'video') - Number(a.mediaType === 'video') : 0) ||
        b.weight - a.weight
      );
      cards.slice(0, Math.min(cards.length, ranked.length)).forEach((card, index) => rewriteWithOfficialSource(card, ranked[index], usedImages, fallbackImages));
      injectGreenSources(ranked);
    }

    repairGenericWeirdTitles(cards);
    dedupeImages(cards);
    window.dispatchEvent(new CustomEvent('infinityphi:media-cards-ready', { detail: { query, count: items.length } }));
  }

  async function refresh() {
    if (!/\/phi(?:\/|$)/.test(location.pathname) || busy) return;
    const query = queryText();
    const cards = cardNodes();
    if (!query || !cards.length) return;

    if (query === lastQuery && officialItems.length) {
      applyOfficialItems(officialItems, query);
      return;
    }

    busy = true;
    try {
      officialItems = SPORTS.test(query) ? await officialSportsSources(query) : [];
      lastQuery = query;
      applyOfficialItems(officialItems, query);
    } finally {
      busy = false;
    }
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(() => void refresh(), 220);
  }

  function shareDataFromCard(card) {
    if (!card) return null;
    return {
      title: clean(card.dataset.gptTitle || card.querySelector('h3')?.textContent, 180),
      body: clean(card.dataset.gptBody || card.querySelector('.phi-orange-copy p')?.textContent || card.querySelector('p')?.textContent, 1200),
      source: clean(card.dataset.phiMediaUrl, 1400),
      image: clean(card.dataset.phiMediaImage || card.querySelector('.phi-orange-main img')?.src, 1400),
      at: Date.now(),
    };
  }

  document.addEventListener('click', (event) => {
    const share = event.target?.closest?.('.phi-share-card');
    if (!share) return;
    pendingShare = shareDataFromCard(share.closest('.phi-orange-card'));
  }, true);

  function installShareBridge() {
    if (typeof navigator.share !== 'function' || navigator.share.__infinityPhiMediaCards) return;
    const previous = navigator.share.bind(navigator);
    const wrapped = async (data = {}) => {
      const current = pendingShare && Date.now() - pendingShare.at < 2200 ? pendingShare : null;
      pendingShare = null;
      if (!current) return previous(data);
      let url = data.url;
      try {
        const parsed = new URL(String(data.url || ''), location.href);
        if (/\/phi(?:\/|$)/.test(parsed.pathname)) {
          if (current.title) parsed.searchParams.set('cardTitle', current.title);
          if (current.body) parsed.searchParams.set('cardBody', current.body.slice(0, 1400));
          if (current.source) parsed.searchParams.set('source', current.source);
          if (current.image) parsed.searchParams.set('image', current.image);
          url = parsed.toString();
        }
      } catch {}
      return previous({ ...data, title: current.title || data.title, text: current.body?.slice(0, 420) || data.text, url });
    };
    wrapped.__infinityPhiMediaCards = true;
    try { Object.defineProperty(navigator, 'share', { configurable: true, value: wrapped }); }
    catch { try { navigator.share = wrapped; } catch {} }
  }

  if (!/\/phi(?:\/|$)/.test(location.pathname)) return;
  installShareBridge();
  installStyles();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule, { once: true });
  else schedule();
  window.addEventListener('infinityphi:gpt-cards-ready', schedule);
  window.addEventListener('popstate', schedule);
  window.addEventListener('focus', () => { installShareBridge(); schedule(); });
  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();