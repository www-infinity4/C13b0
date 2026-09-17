(() => {
  'use strict';

  if (!/\/phi(?:\/|$)/.test(location.pathname)) return;
  if (window.__infinityPhiImageModeV1) return;
  window.__infinityPhiImageModeV1 = true;

  const SHARED = 'phiShared:collection:v1';
  const IMAGE_SELECTIONS = 'phiShared:imageSelections:v1';
  const OMNI_RESEARCH = 'omniPhi:lastResearch:v1';
  const BUILDER = 'https://www-infinity4.github.io/Omni-Phi/cards/';
  const VISUAL_WORDS = /\b(images?|photos?|pictures?|photographs?|visuals?|artwork|posters?|logos?|wallpapers?|gallery)\b/gi;
  const state = { query: '', subject: '', images: [], selected: new Map(), page: null, hiddenArticle: null };

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
  const hash = (value) => {
    let h = 2166136261;
    const text = String(value || '');
    for (let i = 0; i < text.length; i += 1) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(36);
  };
  const domainOf = (value) => {
    try { return new URL(value).hostname.replace(/^www\./, ''); }
    catch { return ''; }
  };
  const queryText = () => {
    try {
      return clean(new URLSearchParams(location.search).get('q') || document.querySelector('input[aria-label="Search Infinity Phi"]')?.value || '', 420);
    } catch { return ''; }
  };
  const visualSubject = (query) => clean(query.replace(VISUAL_WORDS, ' ').replace(/\s+/g, ' '), 300) || clean(query, 300);
  const words = (value) => new Set(clean(value).toLowerCase().match(/[a-z0-9]+/g) || []);
  const overlap = (left, right) => {
    const a = words(left), b = words(right);
    let score = 0;
    a.forEach((word) => { if (word.length > 2 && b.has(word)) score += 1; });
    return score;
  };

  function ensureStyle() {
    if (document.getElementById('infinity-phi-image-mode-style')) return;
    const style = document.createElement('style');
    style.id = 'infinity-phi-image-mode-style';
    style.textContent = `
      #infinityPhiImageModeButton{border:1px solid #67e8f9;background:#083344;color:#cffafe;border-radius:999px;padding:8px 12px;font:900 12px/1 system-ui,sans-serif;cursor:pointer}
      #infinityPhiImageMode{margin:0 auto 28px;max-width:72rem;border:1px solid #a5f3fc;border-radius:28px;background:linear-gradient(145deg,#ecfeff,#f8fafc);padding:16px;box-shadow:0 18px 45px rgba(15,23,42,.10)}
      .phi-image-mode-head{display:flex;gap:12px;align-items:flex-start;justify-content:space-between;flex-wrap:wrap}.phi-image-mode-head h1{margin:3px 0 5px;color:#0f172a;font:950 28px/1.05 system-ui,sans-serif}.phi-image-mode-head p{margin:0;color:#475569;font:650 13px/1.45 system-ui,sans-serif;max-width:54rem}.phi-image-mode-kicker{font:900 11px/1 system-ui,sans-serif;color:#0e7490;text-transform:uppercase;letter-spacing:.13em}
      .phi-image-mode-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(165px,1fr));gap:12px;margin-top:16px}.phi-image-pick{overflow:hidden;border:2px solid #bae6fd;border-radius:18px;background:white;box-shadow:0 8px 20px rgba(15,23,42,.07)}.phi-image-pick[data-selected="1"]{border-color:#f97316;box-shadow:0 0 0 3px rgba(249,115,22,.16),0 12px 24px rgba(15,23,42,.12)}.phi-image-pick img{display:block;width:100%;aspect-ratio:4/3;object-fit:cover;background:#e2e8f0}.phi-image-pick-copy{padding:10px}.phi-image-pick strong{display:block;color:#0f172a;font:900 13px/1.3 system-ui,sans-serif}.phi-image-pick small{display:block;margin-top:5px;color:#64748b;font:700 10px/1.35 system-ui,sans-serif}.phi-image-pick-actions{display:grid;gap:6px;margin-top:9px}.phi-image-use,.phi-image-source-link,.phi-image-builder,.phi-image-back{display:flex;align-items:center;justify-content:center;min-height:36px;border-radius:11px;padding:8px 9px;text-decoration:none;font:900 11px/1.1 system-ui,sans-serif;cursor:pointer}.phi-image-use{border:1px solid #fb923c;background:#f97316;color:#fff}.phi-image-pick[data-selected="1"] .phi-image-use{background:#14532d;border-color:#4ade80}.phi-image-source-link{border:1px solid #cbd5e1;background:#f8fafc;color:#334155}.phi-image-selection-bar{position:sticky;bottom:10px;z-index:30;margin-top:16px;border:1px solid #fdba74;border-radius:18px;background:rgba(255,247,237,.97);padding:12px;box-shadow:0 14px 32px rgba(124,45,18,.18);backdrop-filter:blur(8px)}.phi-image-selection-overview{margin:0 0 10px;color:#7c2d12;font:750 13px/1.45 system-ui,sans-serif}.phi-image-selection-actions{display:flex;gap:8px;flex-wrap:wrap}.phi-image-builder{flex:1;min-width:210px;border:1px solid #a7f3d0;background:#10b981;color:#052e16;font-size:13px}.phi-image-builder:disabled{opacity:.5;cursor:not-allowed}.phi-image-back{border:1px solid #cbd5e1;background:#fff;color:#334155}.phi-image-mode-status{margin-top:14px;border-radius:14px;background:#cffafe;padding:10px 12px;color:#164e63;font:800 12px/1.4 system-ui,sans-serif}
    `;
    document.head.appendChild(style);
  }

  async function fetchJson(url, ms = 7000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    try {
      const response = await fetch(url, { cache: 'no-store', signal: controller.signal, headers: { Accept: 'application/json' } });
      return response.ok ? await response.json() : null;
    } catch { return null; }
    finally { clearTimeout(timer); }
  }

  async function wikimedia(subject) {
    const url = new URL('https://commons.wikimedia.org/w/api.php');
    url.search = new URLSearchParams({
      action: 'query', generator: 'search', gsrsearch: subject, gsrnamespace: '6', gsrlimit: '30',
      prop: 'imageinfo', iiprop: 'url|extmetadata|size', iiurlwidth: '1400', format: 'json', origin: '*'
    }).toString();
    const data = await fetchJson(url.toString());
    return Object.values(data?.query?.pages || {}).flatMap((page) => {
      const info = page?.imageinfo?.[0];
      const meta = info?.extmetadata || {};
      const image = clean(info?.thumburl || info?.url, 1800);
      const sourceUrl = clean(info?.descriptionurl || info?.url, 1800);
      const title = clean(meta.ObjectName?.value || page?.title?.replace(/^File:/, '') || subject, 260);
      if (!/^https?:\/\//i.test(image) || !sourceUrl || !title || overlap(subject, title) < 1) return [];
      const description = clean(meta.ImageDescription?.value || meta.Credit?.value || '', 1200);
      const creator = clean(meta.Artist?.value || meta.Credit?.value || '', 180);
      const license = clean(meta.LicenseShortName?.value || meta.UsageTerms?.value || '', 100);
      return [{ image, title, sourceUrl, provider: 'Wikimedia Commons', creator, license, description, width: Number(info?.width || 0), height: Number(info?.height || 0) }];
    });
  }

  async function openverse(subject) {
    const url = new URL('https://api.openverse.org/v1/images/');
    url.search = new URLSearchParams({ q: subject, page_size: '30', license: 'pdm,by,by-sa,cc0' }).toString();
    const data = await fetchJson(url.toString());
    return (data?.results || []).flatMap((item) => {
      const image = clean(item?.thumbnail || item?.url, 1800);
      const sourceUrl = clean(item?.foreign_landing_url || item?.url, 1800);
      const title = clean(item?.title || subject, 260);
      const tags = Array.isArray(item?.tags) ? item.tags.map((tag) => tag?.name).filter(Boolean).join(' ') : '';
      if (!/^https?:\/\//i.test(image) || !sourceUrl || overlap(subject, `${title} ${tags}`) < 1) return [];
      return [{ image, title, sourceUrl, provider: clean(item?.source || item?.provider || 'Openverse', 100), creator: clean(item?.creator, 180), license: clean(item?.license, 100), description: clean(tags ? `Image tags: ${tags}.` : '', 1200), width: Number(item?.width || 0), height: Number(item?.height || 0) }];
    });
  }

  function score(item, subject) {
    return overlap(subject, `${item.title} ${item.description}`) * 20 + (item.width >= item.height ? 2 : 0) + (item.provider === 'Wikimedia Commons' ? 1 : 0);
  }

  async function searchImages(subject) {
    const [left, right] = await Promise.all([wikimedia(subject), openverse(subject)]);
    const seen = new Set();
    return [...left, ...right]
      .filter((item) => {
        const key = (item.sourceUrl || item.image).toLowerCase();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => score(b, subject) - score(a, subject))
      .slice(0, 36);
  }

  function recordFor(item) {
    const query = state.query;
    const key = item.sourceUrl || item.image;
    const details = [item.description, item.creator ? `Creator: ${item.creator}.` : '', item.license ? `License: ${item.license}.` : ''].filter(Boolean).join(' ');
    return {
      id: `infinity-image-${hash(key)}`,
      storyKey: key,
      title: item.title || state.subject || query,
      sourceTitle: item.title || state.subject || query,
      extract: clean(`${item.title}. ${details} Selected as visual evidence for ${query}.`, 1800),
      sourceExtract: clean(`${item.title}. ${details}`, 1800),
      url: item.sourceUrl,
      sourceUrl: item.sourceUrl,
      image: item.image,
      imageUrl: item.image,
      imageSourceUrl: item.sourceUrl,
      domain: domainOf(item.sourceUrl) || item.provider,
      provider: item.provider,
      creator: item.creator || '',
      license: item.license || '',
      imageVerified: true,
      sourceBacked: true,
      sourceLocked: true,
      selectedFromImageSearch: true,
      searchQuery: query,
      collectedAt: new Date().toISOString(),
      collectedFrom: 'Infinity Phi image mode',
      kind: 'image-seed'
    };
  }

  function selectedRecords() {
    return [...state.selected.values()].map(recordFor);
  }

  function buildOverview(records) {
    if (!records.length) return 'Choose images to create the working overview. Nothing from the normal result overview is used in Image Mode.';
    const names = records.slice(0, 6).map((item) => item.title).filter(Boolean);
    const sources = [...new Set(records.map((item) => item.provider).filter(Boolean))].slice(0, 4);
    return clean(`Selected visual evidence for ${state.query}: ${names.join('; ')}. These chosen images and their credited source pages now define the working overview${sources.length ? ` across ${sources.join(', ')}` : ''}.`, 1800);
  }

  function persistSelection() {
    const records = selectedRecords();
    const shared = read(SHARED, []);
    const sharedList = Array.isArray(shared) ? shared : [];
    const byKey = new Map(sharedList.map((item) => [item?.storyKey || item?.url || item?.id, item]));
    records.forEach((record) => byKey.set(record.storyKey, { ...(byKey.get(record.storyKey) || {}), ...record }));
    write(SHARED, [...byKey.values()].sort((a, b) => String(b?.collectedAt || '').localeCompare(String(a?.collectedAt || ''))).slice(0, 500));

    const oldSelections = read(IMAGE_SELECTIONS, []);
    const selectionMap = new Map((Array.isArray(oldSelections) ? oldSelections : []).map((item) => [item?.storyKey || item?.url || item?.id, item]));
    records.forEach((record) => selectionMap.set(record.storyKey, record));
    write(IMAGE_SELECTIONS, [...selectionMap.values()].slice(0, 300));

    const count = Math.max(1, records.length);
    const nodes = records.slice(0, 24).map((record, index) => {
      const angle = (index / count) * Math.PI * 2;
      return {
        id: `image-node-${index}-${hash(record.storyKey)}`,
        hash: `#${String(index + 1).padStart(2, '0')}`,
        label: record.title,
        affinity: Math.max(.35, 1 - index / Math.max(6, count + 2)),
        position: { x: Math.cos(angle) * .8, y: Math.sin(angle) * .8, z: ((index % 5) - 2) * .12 },
        sourceIndexes: [index]
      };
    });
    const research = {
      version: 'infinity-image-selection-v1',
      query: state.query,
      mode: 'image-selection',
      createdAt: new Date().toISOString(),
      overview: buildOverview(records),
      source: { id: 'source', label: state.query, position: { x: 0, y: 0, z: 0 }, affinity: 1 },
      nodes,
      sources: records,
      sourceSystem: 'Infinity Phi Image Mode → News Phi + Omni website builder',
      imageSelectionCount: records.length,
      profileSnapshot: {}
    };
    write(OMNI_RESEARCH, research);
    window.dispatchEvent(new CustomEvent('controlphi:shared', { detail: { source: 'infinity-phi-image-mode', count: records.length } }));
    window.dispatchEvent(new Event('infinity-history-updated'));
    return research;
  }

  function renderSelectionBar() {
    const page = state.page;
    if (!page) return;
    const records = selectedRecords();
    const overview = page.querySelector('.phi-image-selection-overview');
    const builder = page.querySelector('.phi-image-builder');
    if (overview) overview.textContent = buildOverview(records);
    if (builder) {
      builder.disabled = records.length === 0;
      builder.textContent = records.length ? `Build Website with ${records.length} Selected Image${records.length === 1 ? '' : 's'} →` : 'Select images to build website';
    }
  }

  function toggleImage(item, article, button) {
    const key = item.sourceUrl || item.image;
    if (state.selected.has(key)) state.selected.delete(key);
    else state.selected.set(key, item);
    const selected = state.selected.has(key);
    article.dataset.selected = selected ? '1' : '0';
    button.textContent = selected ? '✓ Use this image' : 'Use this image';
    persistSelection();
    renderSelectionBar();
  }

  function imageCard(item) {
    const article = document.createElement('article');
    article.className = 'phi-image-pick';
    article.dataset.selected = state.selected.has(item.sourceUrl || item.image) ? '1' : '0';
    const image = document.createElement('img');
    image.src = item.image;
    image.alt = item.title || state.subject;
    image.loading = 'lazy';
    image.decoding = 'async';
    image.addEventListener('error', () => article.remove(), { once: true });
    const copy = document.createElement('div');
    copy.className = 'phi-image-pick-copy';
    const title = document.createElement('strong');
    title.textContent = item.title || 'Image result';
    const source = document.createElement('small');
    source.textContent = [item.provider, item.creator, item.license].filter(Boolean).join(' · ');
    const actions = document.createElement('div');
    actions.className = 'phi-image-pick-actions';
    const use = document.createElement('button');
    use.type = 'button';
    use.className = 'phi-image-use';
    use.textContent = article.dataset.selected === '1' ? '✓ Use this image' : 'Use this image';
    use.addEventListener('click', () => toggleImage(item, article, use));
    const link = document.createElement('a');
    link.className = 'phi-image-source-link';
    link.href = item.sourceUrl;
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = `Source · ${domainOf(item.sourceUrl) || item.provider}`;
    actions.append(use, link);
    copy.append(title, source, actions);
    article.append(image, copy);
    return article;
  }

  function leaveMode() {
    if (state.page) state.page.remove();
    state.page = null;
    if (state.hiddenArticle) state.hiddenArticle.hidden = false;
    state.hiddenArticle = null;
  }

  async function enterMode() {
    const query = queryText();
    if (!query) return;
    ensureStyle();
    state.query = query;
    state.subject = visualSubject(query);
    state.images = [];
    state.selected.clear();

    const main = document.querySelector('main[aria-live="polite"]') || document.querySelector('main');
    if (!main) return;
    if (state.page) state.page.remove();
    const article = main.querySelector(':scope > article');
    if (article) {
      article.hidden = true;
      state.hiddenArticle = article;
    }

    const page = document.createElement('section');
    page.id = 'infinityPhiImageMode';
    page.innerHTML = `
      <div class="phi-image-mode-head">
        <div><div class="phi-image-mode-kicker">Image Mode</div><h1>${clean(state.subject)}</h1><p>Pick the images you want to work with. The normal AI overview is intentionally hidden here. Your selected images and their source information become the overview, News Phi card evidence, and the website-builder source set.</p></div>
      </div>
      <div class="phi-image-mode-status">Finding source-backed images…</div>
      <div class="phi-image-mode-grid"></div>
      <div class="phi-image-selection-bar">
        <p class="phi-image-selection-overview">Choose images to create the working overview. Nothing from the normal result overview is used in Image Mode.</p>
        <div class="phi-image-selection-actions"><button class="phi-image-builder" type="button" disabled>Select images to build website</button><button class="phi-image-back" type="button">Back to normal results</button></div>
      </div>`;
    const searchSection = main.querySelector(':scope > section');
    if (searchSection) searchSection.insertAdjacentElement('afterend', page);
    else main.prepend(page);
    state.page = page;
    page.querySelector('.phi-image-back')?.addEventListener('click', leaveMode);
    page.querySelector('.phi-image-builder')?.addEventListener('click', () => {
      const research = persistSelection();
      if (!research.sources.length) return;
      const params = new URLSearchParams({ q: state.query, mode: 'search', from: 'infinity-image', imageMode: '1' });
      location.href = `${BUILDER}?${params.toString()}`;
    });

    const results = await searchImages(state.subject);
    if (state.page !== page) return;
    state.images = results;
    const status = page.querySelector('.phi-image-mode-status');
    const grid = page.querySelector('.phi-image-mode-grid');
    if (status) status.textContent = results.length ? `${results.length} image choices ready. Pick any combination; each selection is saved into the shared News Phi / website-builder data.` : 'No usable image sources were returned for this wording. Try a broader search and press Images again.';
    if (grid) results.forEach((item) => grid.appendChild(imageCard(item)));
  }

  function installButton() {
    if (document.getElementById('infinityPhiImageModeButton')) return true;
    const input = document.querySelector('input[aria-label="Search Infinity Phi"]');
    const searchSection = input?.closest('section');
    const host = searchSection?.querySelector('div');
    if (!input || !host || !queryText()) return false;
    ensureStyle();
    const button = document.createElement('button');
    button.id = 'infinityPhiImageModeButton';
    button.type = 'button';
    button.textContent = 'Images';
    button.title = 'Open image selection mode';
    button.addEventListener('click', () => void enterMode());
    host.appendChild(button);
    return true;
  }

  function retryInstall() {
    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      if (installButton() || attempts >= 24) window.clearInterval(timer);
    }, 250);
  }

  retryInstall();
  window.addEventListener('infinity-history-updated', retryInstall);
  window.addEventListener('popstate', retryInstall);
})();