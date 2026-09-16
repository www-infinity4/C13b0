(() => {
  'use strict';

  if (!/\/phi(?:\/|$)/.test(location.pathname)) return;
  if (window.__infinityPhiImageFeedV2) return;
  window.__infinityPhiImageFeedV2 = true;

  const MAX_CARDS = 30;
  const MAX_POOL = 90;
  const SOURCE_PAGE_LIMIT = 12;
  const CACHE_PREFIX = 'infinity_phi_image_feed_v2_';
  const SKIP = new Set(['the','and','for','with','from','about','into','this','that','what','when','where','which','who','why','how','are','was','were','has','have','had','your','you','its','our','search','result','results','evidence','story','related','explore','further','card','cards','infinity','phi']);
  const BAD_IMAGE_HOST = /(?:imgs\.search\.brave\.com|search\.brave\.com|googleusercontent\.com\/proxy|r\.jina\.ai)/i;
  const BAD_IMAGE_NAME = /(?:logo|favicon|avatar|sprite|icon|badge|tracking|pixel|spacer|emoji)/i;
  let timer = 0;
  let busy = false;
  let activeQuery = '';
  let pool = [];

  const clean = (value, max = 2400) => String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);

  const words = (value) => [...new Set((clean(value).toLowerCase().match(/[a-z0-9]+/g) || []).filter((word) => word.length > 2 && !SKIP.has(word)))];
  const overlap = (a, b) => { const right = new Set(words(b)); return words(a).reduce((score, word) => score + Number(right.has(word)), 0); };

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
      if (!value || Date.now() - Number(value.at || 0) > 3 * 60 * 60 * 1000 || !Array.isArray(value.images)) return [];
      return value.images;
    } catch { return []; }
  }

  function saveCache(query, images) {
    try { sessionStorage.setItem(cacheKey(query), JSON.stringify({ at: Date.now(), images: images.slice(0, MAX_POOL) })); } catch {}
  }

  function sourceCards() {
    return [...document.querySelectorAll('.phi-green-card')].flatMap((node) => {
      const url = node instanceof HTMLAnchorElement ? node.href : node.querySelector('a[href]')?.href || '';
      if (!url || url === location.href || /^javascript:/i.test(url)) return [];
      return [{
        url,
        title: clean(node.querySelector('b')?.textContent || node.querySelector('h3')?.textContent, 260),
        body: clean(node.querySelector('p')?.textContent, 1200),
        image: node.querySelector('img')?.src || ''
      }];
    });
  }

  function usableImage(url) {
    if (!/^https?:\/\//i.test(url || '')) return false;
    if (BAD_IMAGE_HOST.test(url)) return false;
    if (BAD_IMAGE_NAME.test(url)) return false;
    if (/\.svg(?:$|\?)/i.test(url)) return false;
    return true;
  }

  async function textFetch(url, ms = 5200) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ms);
    try {
      const response = await fetch(url, { cache: 'no-store', signal: controller.signal, headers: { Accept: 'text/plain' } });
      if (!response.ok) return '';
      return await response.text();
    } catch { return ''; }
    finally { clearTimeout(timeout); }
  }

  async function jsonFetch(url, ms = 6200) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ms);
    try {
      const response = await fetch(url, { cache: 'no-store', signal: controller.signal, headers: { Accept: 'application/json' } });
      if (!response.ok) return null;
      return await response.json();
    } catch { return null; }
    finally { clearTimeout(timeout); }
  }

  function readerUrl(sourceUrl) {
    try {
      const parsed = new URL(sourceUrl);
      return `https://r.jina.ai/http://${parsed.host}${parsed.pathname}${parsed.search}`;
    } catch { return ''; }
  }

  function imagesFromReader(text, source, query) {
    const raw = String(text || '');
    const out = [];
    const seen = new Set();
    const markdown = /!\[([^\]]{0,240})\]\((https?:\/\/[^)\s]+)\)/g;
    let match;
    while ((match = markdown.exec(raw)) && out.length < 14) {
      const title = clean(match[1] || source.title || query, 260);
      const url = match[2];
      if (!usableImage(url)) continue;
      const key = url.replace(/[?#].*$/, '').toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ url, title, source: source.title || source.url, sourceUrl: source.url, sourceText: `${source.title} ${source.body}` });
    }

    const rawImage = /(?:^|\s)(https?:\/\/[^\s)\]]+\.(?:jpe?g|png|webp|avif)(?:\?[^\s)\]]*)?)/gi;
    while ((match = rawImage.exec(raw)) && out.length < 18) {
      const url = match[1];
      if (!usableImage(url)) continue;
      const key = url.replace(/[?#].*$/, '').toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ url, title: source.title || query, source: source.title || source.url, sourceUrl: source.url, sourceText: `${source.title} ${source.body}` });
    }
    return out;
  }

  async function sourcePageImages(query) {
    const sources = sourceCards().slice(0, SOURCE_PAGE_LIMIT);
    const direct = sources.flatMap((source) => usableImage(source.image) ? [{
      url: source.image,
      title: source.title || query,
      source: source.title || source.url,
      sourceUrl: source.url,
      sourceText: `${source.title} ${source.body}`,
    }] : []);

    const fetched = await Promise.allSettled(sources.map(async (source) => {
      const proxy = readerUrl(source.url);
      if (!proxy) return [];
      const text = await textFetch(proxy);
      return imagesFromReader(text, source, query);
    }));

    return [...direct, ...fetched.flatMap((result) => result.status === 'fulfilled' ? result.value : [])];
  }

  function normalizeCommons(data, query) {
    return Object.values(data?.query?.pages || {}).flatMap((page) => {
      const info = page?.imageinfo?.[0];
      const url = clean(info?.thumburl || info?.url, 1800);
      const meta = info?.extmetadata || {};
      const title = clean(meta.ObjectName?.value || page?.title?.replace(/^File:/, '') || '', 260);
      if (!usableImage(url) || !title || overlap(query, title) < 1) return [];
      return [{ url, title, source: 'Wikimedia Commons', sourceUrl: clean(info?.descriptionurl || info?.url, 1800), sourceText: title, width: Number(info?.width || 0), height: Number(info?.height || 0) }];
    });
  }

  function normalizeOpenverse(data, query) {
    return (data?.results || []).flatMap((item) => {
      const url = clean(item?.thumbnail || item?.url, 1800);
      const title = clean(item?.title || '', 260);
      if (!usableImage(url) || !title || overlap(query, title) < 1) return [];
      return [{ url, title, source: 'Openverse', sourceUrl: clean(item?.foreign_landing_url || item?.url, 1800), sourceText: title, width: Number(item?.width || 0), height: Number(item?.height || 0) }];
    });
  }

  async function publicIndexImages(query) {
    const commons = new URL('https://commons.wikimedia.org/w/api.php');
    commons.search = new URLSearchParams({
      action: 'query', generator: 'search', gsrsearch: query, gsrnamespace: '6', gsrlimit: '50',
      prop: 'imageinfo', iiprop: 'url|extmetadata|size', iiurlwidth: '1400', format: 'json', origin: '*'
    }).toString();
    const openverse = new URL('https://api.openverse.org/v1/images/');
    openverse.search = new URLSearchParams({ q: query, page_size: '50', license: 'pdm,by,by-sa,cc0' }).toString();
    const [a, b] = await Promise.all([jsonFetch(commons.toString()), jsonFetch(openverse.toString())]);
    return [...normalizeCommons(a, query), ...normalizeOpenverse(b, query)];
  }

  async function discover(query) {
    const cached = readCache(query);
    if (cached.length >= 20) return cached;

    const [sourceImages, indexedImages] = await Promise.all([
      sourcePageImages(query),
      publicIndexImages(query),
    ]);

    const seen = new Set();
    const images = [...sourceImages, ...indexedImages].filter((item) => {
      const key = String(item.url || '').replace(/[?#].*$/, '').toLowerCase();
      if (!key || seen.has(key) || !usableImage(item.url)) return false;
      seen.add(key);
      return true;
    }).sort((left, right) => {
      const score = (item) => overlap(query, `${item.title} ${item.sourceText || ''}`) * 14
        + (item.source !== 'Wikimedia Commons' && item.source !== 'Openverse' ? 9 : 0)
        + (item.width && item.height && item.width >= item.height ? 2 : 0);
      return score(right) - score(left);
    }).slice(0, MAX_POOL);

    if (images.length) saveCache(query, images);
    return images;
  }

  function cardText(card) {
    return clean(`${card.dataset.gptTitle || card.querySelector('h3')?.textContent || ''} ${card.dataset.gptBody || card.querySelector('.phi-orange-copy p')?.textContent || card.querySelector('p')?.textContent || ''}`, 1600);
  }

  function currentImage(card) {
    const img = card.querySelector('.phi-orange-main img');
    if (!img || img.dataset.phiImageBroken === '1') return null;
    return img;
  }

  function installImage(card, item) {
    const main = card.querySelector('.phi-orange-main');
    if (!main || !item?.url) return false;
    let img = currentImage(card);
    if (!img) {
      img = document.createElement('img');
      img.loading = 'lazy';
      img.decoding = 'async';
      main.prepend(img);
      main.querySelector('.phi-orange-image-fallback')?.remove();
    }
    img.dataset.phiImageBroken = '0';
    img.alt = clean(card.dataset.gptTitle || card.querySelector('h3')?.textContent || item.title, 220);
    img.src = item.url;
    img.addEventListener('error', () => {
      img.dataset.phiImageBroken = '1';
      card.dataset.phiImageFeed = '';
      schedule();
    }, { once: true });
    card.dataset.phiImageFeed = item.url;
    card.dataset.phiImageSource = item.source || '';
    card.dataset.phiImageSourceUrl = item.sourceUrl || '';
    return true;
  }

  function bestUnused(card, images, used) {
    const text = `${queryText()} ${cardText(card)}`;
    let best = null;
    let bestScore = -Infinity;
    images.forEach((item, index) => {
      if (used.has(item.url)) return;
      const sourceMatch = overlap(text, item.sourceText || '') * 8;
      const titleMatch = overlap(text, item.title) * 13;
      const queryMatch = overlap(queryText(), item.title) * 4;
      const directSourceBonus = item.source !== 'Wikimedia Commons' && item.source !== 'Openverse' ? 7 : 0;
      const landscape = item.width && item.height && item.width >= item.height ? 2 : 0;
      const score = sourceMatch + titleMatch + queryMatch + directSourceBonus + landscape - index * 0.01;
      if (score > bestScore) { best = item; bestScore = score; }
    });
    return bestScore >= 1 ? best : null;
  }

  function apply(images) {
    const cards = [...document.querySelectorAll('.phi-orange-card')].slice(0, MAX_CARDS);
    if (!cards.length || !images.length) return 0;
    const used = new Set();
    cards.forEach((card) => { const existing = currentImage(card); if (existing?.src) used.add(existing.src); });
    let filled = 0;
    cards.forEach((card) => {
      if (currentImage(card)) return;
      const item = bestUnused(card, images, used);
      if (!item) return;
      if (installImage(card, item)) { used.add(item.url); filled += 1; }
    });
    if (filled) window.dispatchEvent(new CustomEvent('infinityphi:image-feed-ready', { detail: { query: queryText(), filled, total: cards.length, pool: images.length } }));
    return filled;
  }

  async function targetedFallback(query) {
    const cards = [...document.querySelectorAll('.phi-orange-card')].slice(0, MAX_CARDS).filter((card) => !currentImage(card)).slice(0, 10);
    for (const card of cards) {
      const title = clean(card.dataset.gptTitle || card.querySelector('h3')?.textContent, 180);
      if (!title) continue;
      const targeted = await publicIndexImages(`${query} ${title}`);
      const item = targeted.sort((a, b) => overlap(title, b.title) - overlap(title, a.title))[0];
      if (item) installImage(card, item);
    }
  }

  async function refresh() {
    if (busy) return;
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
    timer = setTimeout(() => void refresh(), 320);
  }

  schedule();
  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('focus', schedule);
  window.addEventListener('popstate', schedule);
  window.addEventListener('infinityphi:gpt-cards-ready', schedule);
  window.addEventListener('infinityphi:media-cards-ready', schedule);
})();
