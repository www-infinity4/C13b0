(() => {
  'use strict';

  if (!/\/phi(?:\/|$)/.test(location.pathname)) return;
  if (window.__infinityPhiResultTools) return;
  window.__infinityPhiResultTools = true;

  const NEWS_PHI = 'https://www-infinity4.github.io/News-Phi/';
  const OMNI_BUILDER = 'https://www-infinity4.github.io/Omni-Phi/cards/';
  const SHARED_COLLECTION = 'phiShared:collection:v1';
  const IMAGE_SELECTIONS = 'phiShared:imageSelections:v1';
  const CURRENT_SEARCH_COLLECTION = 'infinityPhi:currentSearchCollection:v1';
  const OMNI_RESEARCH = 'omniPhi:lastResearch:v1';
  const OMNI_REACTIONS = 'omniPhi:cardReactions:v1';
  const PAGE_SIZE = 50;
  const RENDER_BATCH = 18;
  const BAD_IMAGE = /(?:logo|favicon|avatar|sprite|icon|badge|tracking|pixel|spacer|emoji)/i;
  const SKIP = new Set(['the','and','for','with','from','about','into','this','that','what','when','where','which','who','why','how','are','was','were','has','have','had','your','you','its','our','search','result','results','image','images','card','cards','infinity','phi']);

  let activeQuery = '';
  let page = 0;
  let pool = [];
  let visible = 0;
  let loading = false;
  let sentinelObserver = null;

  const clean = (value, max = 2400) => String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);

  const read = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; }
    catch { return fallback; }
  };
  const write = (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch { return false; }
  };
  const words = (value) => [...new Set((clean(value).toLowerCase().match(/[a-z0-9]+/g) || []).filter((word) => word.length > 2 && !SKIP.has(word)))];
  const overlap = (left, right) => {
    const target = new Set(words(right));
    return words(left).reduce((score, word) => score + Number(target.has(word)), 0);
  };
  const domainOf = (value) => {
    try { return new URL(value, location.href).hostname.replace(/^www\./, ''); }
    catch { return ''; }
  };
  const hash = (value) => {
    let result = 2166136261;
    const text = String(value || '');
    for (let index = 0; index < text.length; index += 1) {
      result ^= text.charCodeAt(index);
      result = Math.imul(result, 16777619);
    }
    return (result >>> 0).toString(36);
  };

  function queryText() {
    try {
      return clean(new URLSearchParams(location.search).get('q') || document.querySelector('input[aria-label="Search Infinity Phi"]')?.value || '', 420);
    } catch { return ''; }
  }

  function usableImage(url) {
    if (!/^https?:\/\//i.test(url || '')) return false;
    if (BAD_IMAGE.test(url)) return false;
    if (/\.svg(?:$|\?)/i.test(url)) return false;
    return true;
  }

  function sourceCards() {
    return [...document.querySelectorAll('.phi-green-card')].flatMap((node) => {
      const url = node instanceof HTMLAnchorElement ? node.href : node.querySelector('a[href]')?.href || '';
      if (!/^https?:\/\//i.test(url)) return [];
      const title = clean(node.querySelector('b')?.textContent || node.querySelector('h3')?.textContent || domainOf(url), 260);
      const body = clean(node.querySelector('p')?.textContent || '', 1800);
      return [{ url, title, body, domain: domainOf(url) }];
    });
  }

  function readerUrl(sourceUrl) {
    try {
      const parsed = new URL(sourceUrl);
      return `https://r.jina.ai/http://${parsed.host}${parsed.pathname}${parsed.search}`;
    } catch { return ''; }
  }

  async function textFetch(url, ms = 6200) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    try {
      const response = await fetch(url, { cache: 'no-store', signal: controller.signal, headers: { Accept: 'text/plain' } });
      return response.ok ? await response.text() : '';
    } catch { return ''; }
    finally { clearTimeout(timer); }
  }

  async function jsonFetch(url, ms = 6800) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    try {
      const response = await fetch(url, { cache: 'no-store', signal: controller.signal, headers: { Accept: 'application/json' } });
      return response.ok ? await response.json() : null;
    } catch { return null; }
    finally { clearTimeout(timer); }
  }

  function articleText(raw, source) {
    const stripped = String(raw || '')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
      .replace(/\[[^\]]+\]\([^)]*\)/g, ' ')
      .replace(/^#{1,6}\s+/gm, ' ')
      .replace(/[>*_`|]/g, ' ');
    return clean(`${source.title}. ${source.body}. ${stripped}`, 2200);
  }

  function imagesFromReader(raw, source) {
    const text = String(raw || '');
    const story = articleText(text, source);
    const out = [];
    const seen = new Set();
    const markdown = /!\[([^\]]{0,240})\]\((https?:\/\/[^)\s]+)\)/g;
    let match;
    while ((match = markdown.exec(text)) && out.length < 30) {
      const url = match[2];
      if (!usableImage(url)) continue;
      const key = url.replace(/[?#].*$/, '').toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        url,
        title: clean(match[1] || source.title, 260) || source.title,
        source: source.domain || domainOf(source.url) || 'Source page',
        sourceUrl: source.url,
        sourceText: story,
        directSource: true,
      });
    }
    const rawImage = /(?:^|\s)(https?:\/\/[^\s)\]]+\.(?:jpe?g|png|webp|avif)(?:\?[^\s)\]]*)?)/gi;
    while ((match = rawImage.exec(text)) && out.length < 40) {
      const url = match[1];
      if (!usableImage(url)) continue;
      const key = url.replace(/[?#].*$/, '').toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        url,
        title: source.title,
        source: source.domain || domainOf(source.url) || 'Source page',
        sourceUrl: source.url,
        sourceText: story,
        directSource: true,
      });
    }
    return out;
  }

  async function sourcePageImages() {
    const sources = sourceCards().slice(0, 16);
    const settled = await Promise.allSettled(sources.map(async (source) => {
      const raw = await textFetch(readerUrl(source.url));
      return imagesFromReader(raw, source);
    }));
    return settled.flatMap((result) => result.status === 'fulfilled' ? result.value : []);
  }

  function commonsImages(data, query) {
    return Object.values(data?.query?.pages || {}).flatMap((item) => {
      const info = item?.imageinfo?.[0];
      const url = clean(info?.thumburl || info?.url, 1800);
      const meta = info?.extmetadata || {};
      const title = clean(meta.ObjectName?.value || item?.title?.replace(/^File:/, '') || '', 260);
      const sourceUrl = clean(info?.descriptionurl || info?.url, 1800);
      if (!usableImage(url) || !title || overlap(query, title) < 1) return [];
      return [{
        url,
        title,
        source: 'Wikimedia Commons',
        sourceUrl,
        sourceText: clean(`${title}. Wikimedia Commons image record for ${query}.`, 1000),
        width: Number(info?.width || 0),
        height: Number(info?.height || 0),
        directSource: false,
      }];
    });
  }

  function openverseImages(data, query) {
    return (data?.results || []).flatMap((item) => {
      const url = clean(item?.thumbnail || item?.url, 1800);
      const title = clean(item?.title || '', 260);
      const sourceUrl = clean(item?.foreign_landing_url || item?.url, 1800);
      if (!usableImage(url) || !title || overlap(query, `${title} ${item?.tags?.map?.((tag) => tag?.name).join(' ') || ''}`) < 1) return [];
      return [{
        url,
        title,
        source: clean(item?.source || item?.provider || 'Openverse', 120),
        sourceUrl,
        sourceText: clean(`${title}. ${item?.creator ? `Created by ${item.creator}. ` : ''}${item?.license ? `License ${item.license}. ` : ''}Image indexed by Openverse for ${query}.`, 1000),
        width: Number(item?.width || 0),
        height: Number(item?.height || 0),
        directSource: false,
      }];
    });
  }

  async function indexedImages(query, nextPage) {
    const offset = Math.max(0, nextPage - 1) * PAGE_SIZE;
    const commons = new URL('https://commons.wikimedia.org/w/api.php');
    commons.search = new URLSearchParams({
      action: 'query', generator: 'search', gsrsearch: query, gsrnamespace: '6', gsrlimit: String(PAGE_SIZE), gsroffset: String(offset),
      prop: 'imageinfo', iiprop: 'url|extmetadata|size', iiurlwidth: '1500', format: 'json', origin: '*'
    }).toString();
    const openverse = new URL('https://api.openverse.org/v1/images/');
    openverse.search = new URLSearchParams({ q: query, page_size: String(PAGE_SIZE), page: String(nextPage), license: 'pdm,by,by-sa,cc0' }).toString();
    const [left, right] = await Promise.all([jsonFetch(commons.toString()), jsonFetch(openverse.toString())]);
    return [...commonsImages(left, query), ...openverseImages(right, query)];
  }

  function mergePool(items, query) {
    const known = new Set(pool.map((item) => String(item.url || '').replace(/[?#].*$/, '').toLowerCase()));
    const fresh = items.filter((item) => {
      const key = String(item.url || '').replace(/[?#].*$/, '').toLowerCase();
      if (!key || known.has(key) || !usableImage(item.url)) return false;
      known.add(key);
      return true;
    });
    fresh.sort((left, right) => {
      const score = (item) => overlap(query, `${item.title} ${item.sourceText || ''}`) * 12 + (item.directSource ? 18 : 0) + (item.width >= item.height ? 2 : 0);
      return score(right) - score(left);
    });
    pool.push(...fresh);
    return fresh.length;
  }

  async function loadNextPage() {
    const query = queryText();
    if (!query || loading) return 0;
    if (activeQuery !== query) {
      activeQuery = query;
      page = 0;
      pool = [];
      visible = 0;
      document.getElementById('infinityPhiImageGrid')?.replaceChildren();
    }
    loading = true;
    page += 1;
    setImageStatus(`Finding image sources · page ${page}…`);
    try {
      const [direct, indexed] = await Promise.all([
        page === 1 ? sourcePageImages() : Promise.resolve([]),
        indexedImages(query, page),
      ]);
      const added = mergePool([...direct, ...indexed], query);
      setImageStatus(added ? `${pool.length} image results ready · source pages are ranked first` : 'No new unique images on this page · continuing…');
      return added;
    } finally {
      loading = false;
    }
  }

  function ensureStyles() {
    if (document.getElementById('infinity-phi-result-tools-style')) return;
    const style = document.createElement('style');
    style.id = 'infinity-phi-result-tools-style';
    style.textContent = `
      #infinityPhiImagesButton{border:1px solid #67e8f9;background:#083344;color:#cffafe;border-radius:999px;padding:8px 12px;font:900 12px/1 system-ui,sans-serif;box-shadow:0 7px 18px rgba(8,51,68,.18)}
      #infinityPhiImageExplorer{margin:0 0 1.75rem;border:1px solid #a5f3fc;border-radius:28px;background:linear-gradient(145deg,#ecfeff,#f8fafc);padding:18px;box-shadow:0 18px 45px rgba(15,23,42,.10)}
      #infinityPhiImageExplorer[hidden]{display:none!important}.phi-image-head{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;flex-wrap:wrap}.phi-image-head h2{margin:3px 0 0;font:950 25px/1.05 system-ui,sans-serif;color:#0f172a}.phi-image-head p{margin:0;color:#475569;font:650 13px/1.4 system-ui,sans-serif}.phi-image-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:12px;margin-top:15px}.phi-image-result{overflow:hidden;border:1px solid #bae6fd;border-radius:18px;background:#fff;box-shadow:0 8px 22px rgba(15,23,42,.08)}.phi-image-result img{display:block;width:100%;aspect-ratio:4/3;object-fit:cover;background:#e2e8f0}.phi-image-copy{padding:11px}.phi-image-copy strong{display:block;color:#0f172a;font:900 13px/1.3 system-ui,sans-serif}.phi-image-copy small{display:block;margin-top:5px;color:#64748b;font:700 10px/1.3 system-ui,sans-serif}.phi-image-actions{display:grid;gap:6px;margin-top:9px}.phi-image-create,.phi-image-source{display:flex;align-items:center;justify-content:center;min-height:35px;border-radius:11px;padding:8px 9px;text-decoration:none;font:900 11px/1.1 system-ui,sans-serif}.phi-image-create{border:1px solid #fb923c;background:#f97316;color:#fff}.phi-image-source{border:1px solid #cbd5e1;background:#f8fafc;color:#334155}.phi-image-more{display:block;width:100%;margin-top:14px;border:1px solid #0891b2;border-radius:14px;background:#0e7490;color:white;padding:12px;font:900 13px/1 system-ui,sans-serif}.phi-image-sentinel{height:2px}
      #infinityPhiWebsitePanel{margin:16px 0 0;border:2px solid #34d399;border-radius:24px;background:linear-gradient(135deg,#064e3b,#065f46);padding:18px;color:white;box-shadow:0 18px 42px rgba(6,78,59,.24)}#infinityPhiWebsitePanel h2{margin:0;font:950 24px/1.1 system-ui,sans-serif}#infinityPhiWebsitePanel p{margin:8px 0 13px;color:#d1fae5;font:600 13px/1.5 system-ui,sans-serif}#infinityPhiGenerateWebsite{display:flex;align-items:center;justify-content:center;min-height:48px;border:1px solid #a7f3d0;border-radius:14px;background:#10b981;color:#052e16;text-decoration:none;font:950 14px/1 system-ui,sans-serif;box-shadow:0 9px 24px rgba(16,185,129,.24)}
      .phi-reaction-steer{margin:0 0 12px;padding:9px 11px;border:1px solid rgba(240,171,252,.32);border-radius:13px;background:rgba(255,255,255,.08);color:#f5d0fe;font:800 12px/1.35 system-ui,sans-serif}.phi-reaction-top{outline:2px solid rgba(244,114,182,.55);outline-offset:2px}
    `;
    document.head.appendChild(style);
  }

  function topControls() {
    const searchInput = document.querySelector('input[aria-label="Search Infinity Phi"]');
    const searchSection = searchInput?.closest('section');
    return searchSection?.querySelector('div') || searchSection;
  }

  function ensureImageButton() {
    if (document.getElementById('infinityPhiImagesButton')) return;
    const query = queryText();
    const host = topControls();
    if (!query || !host) return;
    const button = document.createElement('button');
    button.id = 'infinityPhiImagesButton';
    button.type = 'button';
    button.textContent = 'Images ∞';
    button.setAttribute('aria-controls', 'infinityPhiImageExplorer');
    button.addEventListener('click', async () => {
      const panel = ensureImagePanel();
      panel.hidden = !panel.hidden;
      button.setAttribute('aria-expanded', String(!panel.hidden));
      if (!panel.hidden) {
        await ensureMoreImages();
        panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
    host.appendChild(button);
  }

  function heroSection() {
    return document.querySelector('.phi-editorial-deck')?.closest('section') || null;
  }

  function ensureImagePanel() {
    let panel = document.getElementById('infinityPhiImageExplorer');
    if (panel) return panel;
    panel = document.createElement('section');
    panel.id = 'infinityPhiImageExplorer';
    panel.hidden = true;
    panel.innerHTML = `
      <div class="phi-image-head">
        <div><small style="font:900 11px/1 system-ui,sans-serif;color:#0e7490;text-transform:uppercase;letter-spacing:.13em">Image discovery</small><h2>Keep exploring images</h2></div>
        <p id="infinityPhiImageStatus">Opening source-backed image results…</p>
      </div>
      <div class="phi-image-grid" id="infinityPhiImageGrid"></div>
      <button class="phi-image-more" id="infinityPhiImageMore" type="button">Show more images</button>
      <div class="phi-image-sentinel" id="infinityPhiImageSentinel" aria-hidden="true"></div>`;
    const hero = heroSection();
    if (hero?.parentElement) hero.insertAdjacentElement('afterend', panel);
    else document.querySelector('main')?.appendChild(panel);
    panel.querySelector('#infinityPhiImageMore')?.addEventListener('click', () => void ensureMoreImages(true));
    const sentinel = panel.querySelector('#infinityPhiImageSentinel');
    if (sentinel && 'IntersectionObserver' in window) {
      sentinelObserver?.disconnect();
      sentinelObserver = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting) && !panel.hidden) void ensureMoreImages(true);
      }, { rootMargin: '650px 0px' });
      sentinelObserver.observe(sentinel);
    }
    return panel;
  }

  function setImageStatus(message) {
    const status = document.getElementById('infinityPhiImageStatus');
    if (status) status.textContent = message;
  }

  function currentSearchItems(query = queryText()) {
    const normalized = clean(query).toLowerCase();
    const shared = read(SHARED_COLLECTION, []);
    return (Array.isArray(shared) ? shared : []).filter((item) => clean(item?.searchQuery).toLowerCase() === normalized);
  }

  function syncCurrentSearchCollection(query = queryText()) {
    const items = currentSearchItems(query);
    write(CURRENT_SEARCH_COLLECTION, { query, items, updatedAt: new Date().toISOString() });
    window.dispatchEvent(new CustomEvent('infinityphi:current-search-collection', { detail: { query, items } }));
    return items;
  }

  function saveImageSeed(item) {
    const query = queryText();
    const url = item.sourceUrl || item.url;
    const key = url || item.url;
    const record = {
      id: `infinity-image-${hash(`${item.url}|${url}`)}`,
      storyKey: key,
      title: item.title || query || 'Image result',
      sourceTitle: item.title || query || 'Image result',
      extract: clean(item.sourceText || `${item.title}. Image selected from ${item.source || domainOf(url)}.`, 1800),
      sourceExtract: clean(item.sourceText || `${item.title}. Image selected from ${item.source || domainOf(url)}.`, 1800),
      url,
      sourceUrl: url,
      image: item.url,
      imageUrl: item.url,
      imageSourceUrl: item.sourceUrl || '',
      domain: domainOf(url) || item.source || 'Image source',
      provider: item.source || domainOf(url) || 'Image discovery',
      imageVerified: true,
      sourceBacked: Boolean(item.sourceUrl),
      sourceLocked: true,
      searchQuery: query,
      collectedAt: new Date().toISOString(),
      collectedFrom: 'Infinity Phi image search',
      kind: 'image-seed',
    };

    const shared = read(SHARED_COLLECTION, []);
    const list = Array.isArray(shared) ? shared : [];
    const existing = list.findIndex((entry) => (entry?.storyKey || entry?.url || entry?.id) === key);
    if (existing >= 0) list[existing] = { ...list[existing], ...record };
    else list.unshift(record);
    write(SHARED_COLLECTION, list.slice(0, 400));

    const selections = read(IMAGE_SELECTIONS, []);
    const imageList = Array.isArray(selections) ? selections : [];
    write(IMAGE_SELECTIONS, [record, ...imageList.filter((entry) => entry?.image !== record.image && entry?.url !== record.url)].slice(0, 250));

    mergeImageIntoWebsiteData(record);
    syncCurrentSearchCollection(query);
    window.dispatchEvent(new CustomEvent('controlphi:shared', { detail: { source: 'infinity-phi-image', storyKey: key } }));
    window.dispatchEvent(new CustomEvent('infinityphi:image-selected', { detail: record }));
    return record;
  }

  function mergeImageIntoWebsiteData(record) {
    const query = queryText();
    const overview = clean(document.querySelector('.phi-editorial-deck')?.textContent, 2200);
    const existing = read(OMNI_RESEARCH, null);
    const base = existing && String(existing.query || '').toLowerCase() === query.toLowerCase()
      ? existing
      : {
          query,
          mode: 'search',
          createdAt: new Date().toISOString(),
          source: { id: 'source', label: query, position: { x: 0, y: 0, z: 0 }, affinity: 1 },
          nodes: [],
          overview,
          sources: [],
          sourceSystem: 'Infinity Phi → shared Omni website engine',
          profileSnapshot: {},
        };
    const source = {
      id: record.id,
      title: record.title,
      url: record.url,
      domain: record.domain,
      provider: record.provider,
      extract: record.extract,
      image: record.image,
      imageUrl: record.image,
      imageSourceUrl: record.imageSourceUrl,
      storyKey: record.storyKey,
      sourceLocked: true,
      selectedFromImageSearch: true,
    };
    const sources = Array.isArray(base.sources) ? base.sources : [];
    const deduped = [source, ...sources.filter((item) => (item?.storyKey || item?.url || item?.id) !== record.storyKey && item?.image !== record.image)].slice(0, 80);
    write(OMNI_RESEARCH, { ...base, overview: base.overview || overview, sources: deduped, updatedAt: new Date().toISOString() });
  }

  function newsUrlForImage(record) {
    const params = new URLSearchParams({
      collect: '1',
      from: 'infinity-image',
      fromImage: '1',
      sharedTitle: record.title,
      sharedBody: record.extract,
      sharedUrl: record.url || record.image,
      sharedImage: record.image,
      sharedDomain: record.domain,
      sharedQuery: record.searchQuery || queryText(),
      shareTarget: '1',
      title: record.title,
      text: clean(`${record.extract} Image URL: ${record.image}`, 1800),
      url: record.url || record.image,
    });
    return `${NEWS_PHI}?${params.toString()}#story=${encodeURIComponent(record.storyKey || record.id)}`;
  }

  function imageCard(item) {
    const article = document.createElement('article');
    article.className = 'phi-image-result';
    const img = document.createElement('img');
    img.loading = 'lazy';
    img.decoding = 'async';
    img.src = item.url;
    img.alt = item.title || queryText();
    img.addEventListener('error', () => article.remove(), { once: true });
    const copy = document.createElement('div');
    copy.className = 'phi-image-copy';
    const title = document.createElement('strong');
    title.textContent = item.title || 'Image result';
    const source = document.createElement('small');
    source.textContent = item.directSource ? `${item.source || domainOf(item.sourceUrl)} · source page image` : item.source || domainOf(item.sourceUrl) || 'Image index';
    const actions = document.createElement('div');
    actions.className = 'phi-image-actions';
    const create = document.createElement('button');
    create.type = 'button';
    create.className = 'phi-image-create';
    create.textContent = 'Create card · show me more';
    create.addEventListener('click', () => {
      const record = saveImageSeed(item);
      create.textContent = '✓ Added to website data';
      location.href = newsUrlForImage(record);
    });
    actions.appendChild(create);
    if (item.sourceUrl) {
      const link = document.createElement('a');
      link.className = 'phi-image-source';
      link.href = item.sourceUrl;
      link.target = '_blank';
      link.rel = 'noopener';
      link.textContent = `Source · ${domainOf(item.sourceUrl) || item.source || 'open'}`;
      actions.appendChild(link);
    }
    copy.append(title, source, actions);
    article.append(img, copy);
    return article;
  }

  function renderNextBatch() {
    const grid = document.getElementById('infinityPhiImageGrid');
    if (!grid) return 0;
    const end = Math.min(pool.length, visible + RENDER_BATCH);
    for (let index = visible; index < end; index += 1) grid.appendChild(imageCard(pool[index]));
    const added = end - visible;
    visible = end;
    return added;
  }

  async function ensureMoreImages(forceNetwork = false) {
    ensureImagePanel();
    if (visible < pool.length && !forceNetwork) {
      renderNextBatch();
      return;
    }
    if (visible < pool.length) renderNextBatch();
    if (visible + 6 >= pool.length || forceNetwork) {
      let attempts = 0;
      let fresh = 0;
      do {
        fresh = await loadNextPage();
        attempts += 1;
      } while (!fresh && attempts < 2);
      renderNextBatch();
    }
  }

  function purpleSection() {
    const heading = [...document.querySelectorAll('h2')].find((node) => /purple cards/i.test(node.textContent || ''));
    return heading?.closest('section') || null;
  }

  function steerPurpleFrom(card) {
    const section = purpleSection();
    if (!section) return;
    const title = clean(card.querySelector('h3')?.textContent || '', 220);
    const focus = clean(`${title} ${card.querySelector('p')?.textContent || ''}`, 1600);
    if (!focus) return;
    const cards = [...section.querySelectorAll('article')];
    if (!cards.length) return;
    cards.forEach((node) => node.classList.remove('phi-reaction-top'));
    cards.sort((left, right) => overlap(focus, right.textContent || '') - overlap(focus, left.textContent || ''));
    const parent = cards[0]?.parentElement;
    if (parent) cards.forEach((node, index) => { parent.appendChild(node); if (index < 3) node.classList.add('phi-reaction-top'); });
    let status = section.querySelector('.phi-reaction-steer');
    if (!status) {
      status = document.createElement('div');
      status.className = 'phi-reaction-steer';
      const headingNode = [...section.querySelectorAll('h2')].find((node) => /purple cards/i.test(node.textContent || ''));
      headingNode?.parentElement?.insertAdjacentElement('afterend', status);
    }
    status.textContent = `Purple directions steered by your orange-card interaction: ${title || 'selected result'}`;
  }

  function restorePurpleSteering() {
    const query = queryText().toLowerCase();
    if (!query) return;
    const reactions = read(OMNI_REACTIONS, []);
    const last = Array.isArray(reactions) ? reactions.find((entry) => String(entry?.query || '').toLowerCase() === query) : null;
    if (!last?.title) return;
    const card = [...document.querySelectorAll('.phi-orange-card')].find((node) => clean(node.querySelector('h3')?.textContent).toLowerCase() === clean(last.title).toLowerCase());
    if (card) steerPurpleFrom(card);
  }

  function saveAllWebsiteData() {
    const query = queryText();
    if (!query) return;
    const existing = read(OMNI_RESEARCH, null);
    const overview = clean(document.querySelector('.phi-editorial-deck')?.textContent, 2200);
    const sourceCards = sourceCards().map((source, index) => ({
      id: `infinity-web-source-${index}-${hash(source.url)}`,
      title: source.title,
      url: source.url,
      domain: source.domain,
      provider: source.domain || 'Public web',
      extract: source.body,
      image: '',
      storyKey: source.url,
      sourceLocked: true,
    }));
    const currentCollected = syncCurrentSearchCollection(query);
    const imageSources = currentCollected.filter((item) => (item?.mediaKind || item?.kind || '').toString().includes('image') || item?.image).map((item) => ({
      id: item.id,
      title: item.title,
      url: item.url,
      domain: item.domain,
      provider: item.provider,
      extract: item.extract,
      image: item.image,
      imageUrl: item.image,
      imageSourceUrl: item.imageSourceUrl,
      storyKey: item.storyKey,
      sourceLocked: true,
      selectedFromImageSearch: true,
    })) || [];
    const base = existing && String(existing.query || '').toLowerCase() === query.toLowerCase() ? existing : {
      query,
      mode: 'search',
      createdAt: new Date().toISOString(),
      source: { id: 'source', label: query, position: { x: 0, y: 0, z: 0 }, affinity: 1 },
      nodes: [],
      overview,
      sources: [],
      sourceSystem: 'Infinity Phi → shared Omni website engine',
      profileSnapshot: {},
    };
    const mediaSources = currentCollected.filter((item) => ['audio','video'].includes(String(item?.mediaKind || '').toLowerCase())).map((item) => ({
      id: item.id, title: item.title || item.sourceTitle, url: item.url, domain: item.domain, provider: item.provider,
      extract: item.extract || item.sourceExtract, image: item.image || item.imageUrl || '', imageUrl: item.image || item.imageUrl || '',
      storyKey: item.storyKey || item.url || item.id, sourceLocked: true, mediaKind: item.mediaKind, files: item.files || []
    }));
    const combined = [...imageSources, ...mediaSources, ...(Array.isArray(base.sources) ? base.sources : []), ...sourceCards];
    const seen = new Set();
    const sources = combined.filter((item) => {
      const key = item?.storyKey || item?.url || item?.id || item?.title;
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 100);
    write(OMNI_RESEARCH, { ...base, overview: base.overview || overview, sources, updatedAt: new Date().toISOString() });
  }

  function ensureWebsiteButton() {
    if (document.getElementById('infinityPhiWebsitePanel')) return;
    const section = purpleSection();
    const query = queryText();
    if (!section || !query) return;
    const panel = document.createElement('section');
    panel.id = 'infinityPhiWebsitePanel';
    const link = `${OMNI_BUILDER}?${new URLSearchParams({ q: query, mode: 'search', from: 'infinity' })}`;
    panel.innerHTML = `<h2>Generate Website</h2><p>Build from the AI Overview, the orange cards you interacted with, the purple directions they steered, your selected images, and the credited source URLs.</p><a id="infinityPhiGenerateWebsite" href="${link}">Generate the full website →</a>`;
    section.insertAdjacentElement('afterend', panel);
    panel.querySelector('#infinityPhiGenerateWebsite')?.addEventListener('click', () => saveAllWebsiteData());
  }

  function installInteractionSteering() {
    if (document.documentElement.dataset.phiResultSteering === '1') return;
    document.documentElement.dataset.phiResultSteering = '1';
    document.addEventListener('click', (event) => {
      const card = event.target?.closest?.('.phi-orange-card');
      if (!card) return;
      setTimeout(() => steerPurpleFrom(card), 0);
    }, true);
  }

  function refreshShell() {
    const q = queryText();
    if (q && clean(activeQuery).toLowerCase() !== clean(q).toLowerCase()) syncCurrentSearchCollection(q);
    ensureStyles();
    ensureImageButton();
    ensureWebsiteButton();
    restorePurpleSteering();
  }

  installInteractionSteering();
  let refreshTimer = 0;
  const schedule = () => {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(refreshShell, 180);
  };
  schedule();
  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('popstate', schedule);
  window.addEventListener('infinityphi:gpt-cards-ready', schedule);
  window.addEventListener('infinityphi:image-feed-ready', schedule);
})();
