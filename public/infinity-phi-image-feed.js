(() => {
  'use strict';

  const MAX_CARDS = 24;
  const MAX_POOL = 40;
  const CACHE_PREFIX = 'infinity_phi_image_feed_v1_';
  const SKIP = new Set(['the','and','for','with','from','about','into','this','that','what','when','where','which','who','why','how','are','was','were','has','have','had','your','you','its','our','search','result','results','evidence','story','related','explore','further']);
  let timer = 0;
  let busy = false;
  let activeQuery = '';
  let pool = [];

  const clean = (value, max = 2000) => String(value || '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim().slice(0, max);
  const words = (value) => [...new Set((clean(value).toLowerCase().match(/[a-z0-9]+/g) || []).filter((word) => word.length > 2 && !SKIP.has(word)))];
  const overlap = (a, b) => { const right = new Set(words(b)); return words(a).reduce((score, word) => score + Number(right.has(word)), 0); };

  function onPhiPage() {
    return /\/phi(?:\/|$)/.test(location.pathname);
  }

  function queryText() {
    try { return clean(new URLSearchParams(location.search).get('q') || document.querySelector('.phi-search-box input')?.value || document.querySelector('.phi-identity')?.textContent || '', 420); }
    catch { return ''; }
  }

  function cacheKey(query) {
    let h = 2166136261;
    for (let i = 0; i < query.length; i += 1) { h ^= query.charCodeAt(i); h = Math.imul(h, 16777619); }
    return `${CACHE_PREFIX}${(h >>> 0).toString(36)}`;
  }

  function readCache(query) {
    try {
      const value = JSON.parse(sessionStorage.getItem(cacheKey(query)) || 'null');
      if (!value || Date.now() - Number(value.at || 0) > 6 * 60 * 60 * 1000 || !Array.isArray(value.images)) return [];
      return value.images;
    } catch { return []; }
  }

  function saveCache(query, images) {
    try { sessionStorage.setItem(cacheKey(query), JSON.stringify({ at: Date.now(), images: images.slice(0, MAX_POOL) })); } catch {}
  }

  async function jsonFetch(url, ms = 6500) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ms);
    try {
      const response = await fetch(url, { cache: 'no-store', signal: controller.signal, headers: { Accept: 'application/json' } });
      if (!response.ok) return null;
      return await response.json();
    } catch { return null; }
    finally { clearTimeout(timeout); }
  }

  function normalizeCommons(data, query) {
    return Object.values(data?.query?.pages || {}).flatMap((page) => {
      const info = page?.imageinfo?.[0];
      const url = clean(info?.thumburl || info?.url, 1800);
      const meta = info?.extmetadata || {};
      const title = clean(meta.ObjectName?.value || page?.title?.replace(/^File:/, '') || '', 260);
      if (!url || !title || overlap(query, title) < 1) return [];
      return [{ url, title, source: 'Wikimedia Commons', sourceUrl: clean(info?.descriptionurl || info?.url, 1800), width: Number(info?.width || 0), height: Number(info?.height || 0) }];
    });
  }

  function normalizeOpenverse(data, query) {
    return (data?.results || []).flatMap((item) => {
      const url = clean(item?.thumbnail || item?.url, 1800);
      const title = clean(item?.title || '', 260);
      if (!url || !title || overlap(query, title) < 1) return [];
      return [{ url, title, source: 'Openverse', sourceUrl: clean(item?.foreign_landing_url || item?.url, 1800), width: Number(item?.width || 0), height: Number(item?.height || 0) }];
    });
  }

  async function discover(query) {
    const cached = readCache(query);
    if (cached.length >= 12) return cached;
    const commons = new URL('https://commons.wikimedia.org/w/api.php');
    commons.search = new URLSearchParams({
      action: 'query', generator: 'search', gsrsearch: query, gsrnamespace: '6', gsrlimit: '40',
      prop: 'imageinfo', iiprop: 'url|extmetadata|size', iiurlwidth: '1200', format: 'json', origin: '*'
    }).toString();
    const openverse = new URL('https://api.openverse.org/v1/images/');
    openverse.search = new URLSearchParams({ q: query, page_size: '40', license: 'pdm,by,by-sa,cc0' }).toString();
    const [a, b] = await Promise.all([jsonFetch(commons.toString()), jsonFetch(openverse.toString())]);
    const seen = new Set();
    const images = [...normalizeCommons(a, query), ...normalizeOpenverse(b, query)].filter((item) => {
      const key = item.url.replace(/[?#].*$/, '').toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    }).sort((left, right) => {
      const landscapeLeft = left.width && left.height && left.width >= left.height ? 2 : 0;
      const landscapeRight = right.width && right.height && right.width >= right.height ? 2 : 0;
      return (overlap(query, right.title) * 12 + landscapeRight) - (overlap(query, left.title) * 12 + landscapeLeft);
    }).slice(0, MAX_POOL);
    if (images.length) saveCache(query, images);
    return images;
  }

  function cardText(card) {
    return clean(`${card.querySelector('h3')?.textContent || ''} ${card.querySelector('.phi-orange-copy p')?.textContent || card.querySelector('p')?.textContent || ''}`, 1200);
  }

  function currentImage(card) {
    const img = card.querySelector('.phi-orange-main img');
    if (!img) return null;
    if (img.dataset.phiImageBroken === '1') return null;
    return img;
  }

  function installImage(card, item) {
    const main = card.querySelector('.phi-orange-main');
    if (!main || !item?.url) return false;
    let img = currentImage(card);
    if (!img) {
      img = document.createElement('img');
      img.loading = 'lazy';
      main.prepend(img);
      main.querySelector('.phi-orange-image-fallback')?.remove();
    }
    img.dataset.phiImageBroken = '0';
    img.alt = clean(card.querySelector('h3')?.textContent || item.title, 220);
    img.src = item.url;
    img.addEventListener('error', () => {
      img.dataset.phiImageBroken = '1';
      card.dataset.phiImageFeed = '';
      schedule();
    }, { once: true });
    card.dataset.phiImageFeed = item.url;
    card.dataset.phiImageSource = item.source;
    card.dataset.phiImageSourceUrl = item.sourceUrl || '';
    return true;
  }

  function bestUnused(card, images, used) {
    const text = `${queryText()} ${cardText(card)}`;
    let best = null;
    let bestScore = -1;
    images.forEach((item, index) => {
      if (used.has(item.url)) return;
      const score = overlap(text, item.title) * 12 + overlap(queryText(), item.title) * 4 + (item.width && item.height && item.width >= item.height ? 2 : 0) - index * 0.01;
      if (score > bestScore) { best = item; bestScore = score; }
    });
    return best;
  }

  function apply(images) {
    const cards = [...document.querySelectorAll('.phi-orange-card')].slice(0, MAX_CARDS);
    if (!cards.length || !images.length) return 0;
    const used = new Set();
    cards.forEach((card) => {
      const existing = currentImage(card);
      if (existing?.src) used.add(existing.src);
    });
    let filled = 0;
    cards.forEach((card) => {
      if (currentImage(card)) return;
      const item = bestUnused(card, images, used);
      if (!item) return;
      if (installImage(card, item)) { used.add(item.url); filled += 1; }
    });
    if (filled) window.dispatchEvent(new CustomEvent('infinityphi:image-feed-ready', { detail: { query: queryText(), filled, total: cards.length } }));
    return filled;
  }

  async function targetedFallback(query) {
    const cards = [...document.querySelectorAll('.phi-orange-card')].slice(0, MAX_CARDS).filter((card) => !currentImage(card)).slice(0, 8);
    for (const card of cards) {
      const title = clean(card.querySelector('h3')?.textContent, 180);
      if (!title) continue;
      const commons = new URL('https://commons.wikimedia.org/w/api.php');
      commons.search = new URLSearchParams({
        action: 'query', generator: 'search', gsrsearch: `${query} ${title}`, gsrnamespace: '6', gsrlimit: '8',
        prop: 'imageinfo', iiprop: 'url|extmetadata|size', iiurlwidth: '1200', format: 'json', origin: '*'
      }).toString();
      const data = await jsonFetch(commons.toString(), 4500);
      const images = normalizeCommons(data, `${query} ${title}`);
      const item = images.sort((a, b) => overlap(title, b.title) - overlap(title, a.title))[0];
      if (item) installImage(card, item);
    }
  }

  async function refresh() {
    if (!onPhiPage() || busy) return;
    const query = queryText();
    const cards = [...document.querySelectorAll('.phi-orange-card')];
    if (!query || !cards.length) return;
    busy = true;
    try {
      if (query !== activeQuery || !pool.length) {
        activeQuery = query;
        pool = await discover(query);
      }
      apply(pool);
      if (cards.some((card) => !currentImage(card))) await targetedFallback(query);
    } finally { busy = false; }
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(() => void refresh(), 380);
  }

  if (!onPhiPage()) return;
  schedule();
  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('focus', schedule);
  window.addEventListener('popstate', schedule);
  window.addEventListener('infinityphi:media-cards-ready', schedule);
  window.addEventListener('infinityphi:gpt-cards-ready', schedule);
})();
