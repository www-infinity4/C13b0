(() => {
  'use strict';

  const COLLECTION_KEY = 'phiShared:collection:v1';
  const IMAGE_CACHE_KEY = 'infinityPhi:orangeImageCache:v2';
  const MAX_CARDS = 24;
  const STOP = new Set([
    'what','when','where','which','who','whom','whose','why','how','is','are','was','were','be','been','being','do','does','did','can','could','would','should','will',
    'the','and','for','with','from','into','about','this','that','these','those','your','their','more','most','some','many','much','have','has','had','found','find','research',
    'science','overview','question','answer','related','further','card','cards','infinity','phi'
  ]);
  let timer = 0;
  let imageBusy = false;
  const imageQueue = [];
  const usedImages = new Set();

  const clean = (value, max = 5000) => String(value || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
  const escapeHtml = (value) => clean(value, 3000).replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

  function onPhiPage() { return /\/phi(?:\/|$)/.test(location.pathname); }

  function queryText() {
    try {
      return clean(new URLSearchParams(location.search).get('q') || document.querySelector('.phi-search-box input')?.value || document.querySelector('.phi-identity')?.textContent || '', 500);
    } catch { return ''; }
  }

  function words(value) {
    return clean(value).toLowerCase().replace(/https?:\/\/\S+/g, ' ').replace(/[^a-z0-9'-]+/g, ' ').split(/\s+/)
      .filter((word) => word.length > 2 && !STOP.has(word) && !/^\d+$/.test(word));
  }

  function importantTerms(value, limit = 8) {
    const counts = new Map();
    words(value).forEach((word, index) => counts.set(word, (counts.get(word) || 0) + (index < 18 ? 2 : 1)));
    return [...counts].sort((a,b) => b[1] - a[1] || b[0].length - a[0].length).map(([word]) => word).slice(0, limit);
  }

  function overlap(a, b) {
    const left = new Set(words(a));
    const right = new Set(words(b));
    let hit = 0;
    left.forEach((word) => { if (right.has(word)) hit += 1; });
    return hit;
  }

  function cardNodes() { return [...document.querySelectorAll('.phi-orange-card')].slice(0, MAX_CARDS); }

  function cardData(card) {
    const title = clean(card.dataset.gptTitle || card.querySelector('h3')?.textContent, 240);
    const body = clean(card.dataset.gptBody || card.querySelector('.phi-orange-copy p')?.textContent || card.querySelector('p')?.textContent, 1800);
    const image = card.querySelector('.phi-orange-main img')?.src || card.querySelector('img')?.src || '';
    return { title, body, image };
  }

  function sourceCandidates() {
    return [...document.querySelectorAll('.phi-green-card')].flatMap((node) => {
      const url = node instanceof HTMLAnchorElement ? node.href : '';
      if (!url || url === location.href || url.endsWith('#')) return [];
      return [{
        node,
        url,
        title: clean(node.querySelector('b')?.textContent, 300),
        provider: clean(node.querySelector('small')?.textContent, 120),
        excerpt: clean(node.querySelector('p')?.textContent, 1800),
        image: node.querySelector('img')?.src || ''
      }];
    });
  }

  function bestSource(card) {
    const data = cardData(card);
    const target = `${data.title} ${data.body}`;
    const candidates = sourceCandidates();
    if (!candidates.length) return null;
    return [...candidates].sort((a,b) => {
      const score = (item) => overlap(target, `${item.title} ${item.excerpt}`) * 4 + overlap(data.title, item.title) * 5 + (item.provider === 'Wikipedia' ? 1 : 0);
      return score(b) - score(a);
    })[0] || null;
  }

  function storyKey(source, title) {
    return source?.url || clean(title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `phi-${Date.now()}`;
  }

  function readJson(key, fallback) {
    try { const value = JSON.parse(localStorage.getItem(key) || 'null'); return value ?? fallback; } catch { return fallback; }
  }

  function isStored(data, source) {
    const key = storyKey(source, data.title);
    return readJson(COLLECTION_KEY, []).some((item) => (item.storyKey || item.url || item.id) === key);
  }

  function toast(message) {
    let node = document.getElementById('infinityPhiCardToast');
    if (!node) {
      node = document.createElement('div');
      node.id = 'infinityPhiCardToast';
      node.setAttribute('role', 'status');
      document.body.appendChild(node);
    }
    node.textContent = message;
    node.classList.add('show');
    clearTimeout(node.__timer);
    node.__timer = setTimeout(() => node.classList.remove('show'), 2400);
  }

  function storeForNewsPhi(card, button) {
    const data = cardData(card);
    const source = bestSource(card);
    const item = {
      id: storyKey(source, data.title),
      storyKey: storyKey(source, data.title),
      title: data.title,
      extract: data.body,
      body: data.body,
      url: source?.url || '',
      provider: source?.provider || 'Infinity Phi',
      domain: source?.provider || 'Infinity Phi research',
      image: data.image || source?.image || '',
      imageVerified: Boolean(data.image || source?.image),
      sourceBacked: Boolean(source?.url),
      searchQuery: queryText(),
      collectedAt: new Date().toISOString(),
      generatedBy: 'infinity-phi-orange-card'
    };
    const collection = readJson(COLLECTION_KEY, []);
    const index = collection.findIndex((entry) => (entry.storyKey || entry.url || entry.id) === item.storyKey);
    if (index >= 0) collection[index] = { ...collection[index], ...item };
    else collection.unshift(item);
    localStorage.setItem(COLLECTION_KEY, JSON.stringify(collection.slice(0, 400)));
    button.textContent = 'Stored ✓ · News Phi';
    button.dataset.stored = '1';
    window.dispatchEvent(new CustomEvent('phiShared:collection-updated', { detail: { card: item } }));
    toast('Saved to News Phi for later reading.');
  }

  function ensureReader() {
    let modal = document.getElementById('infinityPhiSourceReader');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'infinityPhiSourceReader';
    modal.innerHTML = `
      <div class="phi-source-reader-backdrop" data-close-reader></div>
      <section class="phi-source-reader-panel" role="dialog" aria-modal="true" aria-label="Original source reader">
        <header><div><small>Original source</small><strong id="phiSourceReaderTitle">Source</strong></div><div class="phi-source-reader-controls"><a id="phiSourceReaderExternal" href="#" target="_blank" rel="noopener">Open original ↗</a><button type="button" data-close-reader aria-label="Close source reader">×</button></div></header>
        <div class="phi-source-reader-note">The original publisher stays inside this reader when its site allows embedding. If the publisher blocks frames, use “Open original” and your Infinity Phi page stays here.</div>
        <iframe id="phiSourceReaderFrame" title="Original source"></iframe>
      </section>`;
    document.body.appendChild(modal);
    modal.querySelectorAll('[data-close-reader]').forEach((node) => node.addEventListener('click', () => closeReader()));
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeReader(); });
    return modal;
  }

  function closeReader() {
    const modal = document.getElementById('infinityPhiSourceReader');
    if (!modal) return;
    modal.classList.remove('open');
    const frame = modal.querySelector('#phiSourceReaderFrame');
    if (frame) frame.src = 'about:blank';
  }

  function viewSource(card) {
    const source = bestSource(card);
    if (!source?.url) { toast('No original source link is attached to this card yet.'); return; }
    const modal = ensureReader();
    modal.querySelector('#phiSourceReaderTitle').textContent = source.title || source.provider || 'Original source';
    const external = modal.querySelector('#phiSourceReaderExternal');
    external.href = source.url;
    modal.querySelector('#phiSourceReaderFrame').src = source.url;
    modal.classList.add('open');
  }

  function expansionTerms(card) {
    const data = cardData(card);
    const base = new Set(words(queryText()));
    return importantTerms(`${data.title} ${data.body}`, 12).filter((term) => !base.has(term)).slice(0, 5);
  }

  function expandResearch(card) {
    const original = card.querySelector('[data-phi-original-create]');
    if (original) { original.click(); toast('Expanding this orange-card branch…'); return; }

    const section = card.closest('section');
    if (section?.getAttribute('aria-labelledby') === 'phi-discovery-heading') {
      card.querySelector('.phi-orange-main')?.click();
      toast('Expanding this orange-card branch…');
      return;
    }

    const terms = expansionTerms(card);
    const textarea = document.querySelector('#phi-keyword-search');
    const form = textarea?.closest('form');
    if (!textarea || !form || !terms.length) { toast('This card does not have enough indexed terms to expand yet.'); return; }
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
    if (setter) setter.call(textarea, terms.join(', ')); else textarea.value = terms.join(', ');
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.dispatchEvent(new Event('change', { bubbles: true }));
    setTimeout(() => {
      if (typeof form.requestSubmit === 'function') form.requestSubmit();
      else form.querySelector('button[type="submit"]')?.click();
    }, 30);
    toast(`Researching deeper: ${terms.join(' · ')}`);
  }

  function hash(value) {
    let out = 2166136261;
    for (const char of value) { out ^= char.charCodeAt(0); out = Math.imul(out, 16777619); }
    return (out >>> 0).toString(36);
  }

  function imageCache() { return readJson(IMAGE_CACHE_KEY, {}); }
  function saveImageCache(cache) {
    try {
      const trimmed = Object.fromEntries(Object.entries(cache).sort((a,b) => Number(b[1]?.at || 0) - Number(a[1]?.at || 0)).slice(0, 220));
      localStorage.setItem(IMAGE_CACHE_KEY, JSON.stringify(trimmed));
    } catch {}
  }

  function visualTopic(card) {
    const data = cardData(card);
    const query = queryText();
    const terms = importantTerms(`${data.title} ${data.body}`, 8);
    const subject = importantTerms(query, 4);
    return [...new Set([...subject, ...terms])].slice(0, 8).join(' ');
  }

  function scoreImage(item, topic) {
    const target = `${item.alt || ''} ${item.title || ''}`;
    const rel = overlap(target, topic);
    const phrase = clean(target).toLowerCase().includes(clean(topic).toLowerCase()) ? 4 : 0;
    const landscape = item.width && item.height && item.width >= item.height ? 1 : 0;
    return rel * 6 + phrase + landscape;
  }

  async function searchWikimedia(topic) {
    try {
      const endpoint = new URL('https://commons.wikimedia.org/w/api.php');
      endpoint.search = new URLSearchParams({
        action:'query', generator:'search', gsrsearch:topic, gsrnamespace:'6', gsrlimit:'12',
        prop:'imageinfo', iiprop:'url|extmetadata|size', iiurlwidth:'1200', format:'json', origin:'*'
      });
      const response = await fetch(endpoint, { cache:'force-cache' });
      if (!response.ok) return [];
      const json = await response.json();
      return Object.values(json?.query?.pages || {}).flatMap((page) => {
        const info = page?.imageinfo?.[0];
        if (!info?.url) return [];
        const meta = info.extmetadata || {};
        const license = clean(meta.LicenseShortName?.value || meta.License?.value || '').toLowerCase();
        if (!/(public domain|cc0|cc by|cc-by|creative commons)/i.test(license)) return [];
        const alt = clean(meta.ObjectName?.value || page.title?.replace(/^File:/,'') || topic);
        return [{ url: info.thumburl || info.url, alt, width: info.width, height: info.height, sourceUrl: info.descriptionurl || info.url, title: page.title || alt }];
      });
    } catch { return []; }
  }

  async function searchOpenverse(topic) {
    try {
      const endpoint = new URL('https://api.openverse.org/v1/images/');
      endpoint.search = new URLSearchParams({ q: topic, page_size:'12', license:'pdm,by,by-sa,cc0' });
      const response = await fetch(endpoint, { cache:'force-cache' });
      if (!response.ok) return [];
      const json = await response.json();
      return (json.results || []).flatMap((item) => item?.url ? [{
        url: item.thumbnail || item.url,
        alt: clean(item.title || topic),
        title: clean(item.title || topic),
        width: item.width,
        height: item.height,
        sourceUrl: item.foreign_landing_url || item.url
      }] : []);
    } catch { return []; }
  }

  async function findImage(card) {
    const data = cardData(card);
    const topic = visualTopic(card);
    if (!topic) return '';
    const key = hash(`${queryText()}|${data.title}|${data.body}`);
    const cache = imageCache();
    if (cache[key]?.url) return cache[key].url;

    let candidates = await searchWikimedia(topic);
    if (candidates.length < 3) candidates = [...candidates, ...(await searchOpenverse(topic))];
    if (!candidates.length) {
      const subject = importantTerms(queryText(), 3).join(' ');
      if (subject && subject !== topic) candidates = await searchWikimedia(subject);
    }
    const ranked = candidates
      .filter((item) => item.url && !usedImages.has(item.url))
      .sort((a,b) => scoreImage(b, topic) - scoreImage(a, topic));
    const best = ranked[0] || candidates.sort((a,b) => scoreImage(b, topic) - scoreImage(a, topic))[0];
    if (!best?.url) return '';
    cache[key] = { url: best.url, sourceUrl: best.sourceUrl || '', alt: best.alt || data.title, at: Date.now() };
    saveImageCache(cache);
    return best.url;
  }

  function applyImage(card, url) {
    if (!url || !card.isConnected) return;
    const main = card.querySelector('.phi-orange-main');
    if (!main) return;
    let image = main.querySelector('img');
    if (!image) {
      const fallback = main.querySelector('.phi-orange-image-fallback');
      image = document.createElement('img');
      image.loading = 'lazy';
      image.alt = cardData(card).title;
      if (fallback) fallback.replaceWith(image); else main.prepend(image);
    }
    image.src = url;
    image.alt = cardData(card).title;
    image.dataset.phiRelevantImage = '1';
    usedImages.add(url);
  }

  function queueImage(card) {
    if (card.dataset.phiImageQueued === '1') return;
    card.dataset.phiImageQueued = '1';
    imageQueue.push(card);
    void drainImages();
  }

  async function drainImages() {
    if (imageBusy) return;
    imageBusy = true;
    try {
      while (imageQueue.length) {
        const card = imageQueue.shift();
        if (!card?.isConnected) continue;
        try { applyImage(card, await findImage(card)); } catch {}
      }
    } finally { imageBusy = false; }
  }

  function makeButton(label, className, handler) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.textContent = label;
    button.addEventListener('click', (event) => { event.preventDefault(); event.stopPropagation(); handler(button); });
    return button;
  }

  function installCard(card) {
    const actions = card.querySelector('.phi-orange-actions');
    if (!actions) return;

    const existingButtons = [...actions.querySelectorAll(':scope > button')];
    const share = existingButtons.find((button) => button.classList.contains('phi-share-card'));
    const originalCreate = existingButtons.find((button) => button !== share && !button.classList.contains('phi-card-tool'));
    if (originalCreate && !originalCreate.dataset.phiOriginalCreate) {
      originalCreate.dataset.phiOriginalCreate = '1';
      originalCreate.style.display = 'none';
    }
    actions.querySelectorAll(':scope > a').forEach((link) => { link.style.display = 'none'; });

    let create = actions.querySelector('.phi-tool-create');
    if (!create) {
      create = makeButton('Create · expand research', 'phi-card-tool phi-tool-create', () => expandResearch(card));
      actions.prepend(create);
    }

    let store = actions.querySelector('.phi-tool-store');
    if (!store) {
      store = makeButton('Store · News Phi', 'phi-card-tool phi-tool-store', (button) => storeForNewsPhi(card, button));
      create.insertAdjacentElement('afterend', store);
    }

    if (share) {
      share.textContent = 'Share · +1/10 ⭐';
      share.classList.add('phi-card-tool');
      store.insertAdjacentElement('afterend', share);
    }

    let view = actions.querySelector('.phi-tool-view');
    if (!view) {
      view = makeButton('View · source', 'phi-card-tool phi-tool-view', () => viewSource(card));
      actions.appendChild(view);
    }

    const data = cardData(card);
    if (isStored(data, bestSource(card))) {
      store.textContent = 'Stored ✓ · News Phi';
      store.dataset.stored = '1';
    }

    queueImage(card);
  }

  function installStyles() {
    if (document.getElementById('infinityPhiCardToolsStyle')) return;
    const style = document.createElement('style');
    style.id = 'infinityPhiCardToolsStyle';
    style.textContent = `
      .phi-orange-actions{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px!important}
      .phi-orange-actions>.phi-card-tool{display:flex!important;align-items:center;justify-content:center;min-height:42px;padding:9px 10px!important;border-radius:11px!important;font-size:.78rem!important;font-weight:800!important;text-align:center;line-height:1.15}
      .phi-tool-store[data-stored="1"]{outline:2px solid rgba(118,255,170,.55)}
      #infinityPhiCardToast{position:fixed;left:50%;bottom:20px;z-index:100000;transform:translate(-50%,20px);max-width:min(90vw,520px);padding:11px 15px;border-radius:14px;background:#07151f;color:white;border:1px solid rgba(255,255,255,.2);box-shadow:0 14px 50px rgba(0,0,0,.35);opacity:0;pointer-events:none;transition:.18s ease;font-weight:750;text-align:center}
      #infinityPhiCardToast.show{opacity:1;transform:translate(-50%,0)}
      #infinityPhiSourceReader{position:fixed;inset:0;z-index:99999;display:none}
      #infinityPhiSourceReader.open{display:block}
      .phi-source-reader-backdrop{position:absolute;inset:0;background:rgba(0,8,18,.78);backdrop-filter:blur(7px)}
      .phi-source-reader-panel{position:absolute;inset:3vh 3vw;background:#071521;border:1px solid rgba(255,255,255,.2);border-radius:18px;overflow:hidden;display:grid;grid-template-rows:auto auto 1fr;box-shadow:0 24px 80px rgba(0,0,0,.55)}
      .phi-source-reader-panel header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:13px 15px;background:#0b2232;color:#fff;border-bottom:1px solid rgba(255,255,255,.14)}
      .phi-source-reader-panel header>div:first-child{display:grid;gap:2px;min-width:0}.phi-source-reader-panel header small{opacity:.7}.phi-source-reader-panel header strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .phi-source-reader-controls{display:flex;align-items:center;gap:8px;flex:0 0 auto}.phi-source-reader-controls a,.phi-source-reader-controls button{border:1px solid rgba(255,255,255,.22);background:#102e40;color:white;border-radius:10px;padding:8px 10px;text-decoration:none;font-weight:800}.phi-source-reader-controls button{font-size:1.2rem;line-height:1}
      .phi-source-reader-note{padding:8px 14px;background:#112a38;color:#cde7f5;font-size:.78rem;border-bottom:1px solid rgba(255,255,255,.12)}
      #phiSourceReaderFrame{width:100%;height:100%;border:0;background:white}
      @media(max-width:650px){.phi-source-reader-panel{inset:1.5vh 1.5vw;border-radius:14px}.phi-source-reader-controls a{font-size:.72rem}.phi-orange-actions{grid-template-columns:1fr 1fr!important}}
    `;
    document.head.appendChild(style);
  }

  function process() {
    if (!onPhiPage()) return;
    installStyles();
    cardNodes().forEach(installCard);
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(process, 220);
  }

  if (!onPhiPage()) return;
  process();
  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, { childList:true, subtree:true, characterData:true });
  window.addEventListener('infinityphi:gpt-cards-ready', () => {
    cardNodes().forEach((card) => { card.dataset.phiImageQueued = '0'; });
    schedule();
  });
  window.addEventListener('popstate', schedule);
  window.addEventListener('focus', schedule);
})();