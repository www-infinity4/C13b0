(() => {
  'use strict';

  const IMAGE_CACHE = 'infinityPhi:missingCardImages:v1';
  const MAX_CARDS = 30;
  let timer = 0;
  let imagePassRunning = false;
  let processRunning = false;
  let rerunRequested = false;

  const clean = (value, max = 1800) => String(value || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
  const readJson = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; } catch { return fallback; } };
  const writeJson = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} };
  const onPhi = () => /\/phi(?:\/|$)/.test(location.pathname);

  function queryText() {
    try {
      const params = new URLSearchParams(location.search);
      return clean(params.get('q') || document.querySelector('.phi-identity')?.textContent || '', 500);
    } catch { return ''; }
  }

  function words(value) {
    const stop = new Set(['what','when','where','which','who','why','how','the','and','for','with','from','into','about','this','that','these','those','your','their','more','most','some','many','have','has','had','found','find','research','science','overview','question','answer','related','further','card','cards','infinity','phi','was','were','are','is']);
    return clean(value).toLowerCase().replace(/https?:\/\/\S+/g, ' ').replace(/[^a-z0-9'-]+/g, ' ').split(/\s+/).filter((word) => word.length > 2 && !stop.has(word));
  }

  function overlap(a, b) {
    const left = new Set(words(a));
    const right = new Set(words(b));
    let hit = 0;
    left.forEach((word) => { if (right.has(word)) hit += 1; });
    return hit;
  }

  function cardInfo(card) {
    return {
      title: clean(card.querySelector('h3')?.textContent, 260),
      body: clean(card.querySelector('.phi-orange-copy p')?.textContent || card.querySelector('p')?.textContent, 1600),
    };
  }

  function sourceImages() {
    return [...document.querySelectorAll('.phi-green-card')].flatMap((node) => {
      const img = node.querySelector('img');
      if (!img?.src) return [];
      return [{
        url: img.src,
        title: clean(node.querySelector('b')?.textContent, 260),
        body: clean(node.querySelector('p')?.textContent, 1200),
      }];
    });
  }

  function bestExistingSourceImage(card) {
    const data = cardInfo(card);
    const target = `${data.title} ${data.body}`;
    return sourceImages().sort((a, b) => overlap(target, `${b.title} ${b.body}`) - overlap(target, `${a.title} ${a.body}`))[0]?.url || '';
  }

  function cacheKey(card) {
    const data = cardInfo(card);
    return clean(`${queryText()}|${data.title}`, 700).toLowerCase();
  }

  function installImage(card, url) {
    if (!url || card.querySelector('.phi-orange-main img')) return false;
    const fallback = card.querySelector('.phi-orange-image-fallback');
    const main = card.querySelector('.phi-orange-main');
    if (!fallback || !main) return false;

    const rect = fallback.getBoundingClientRect();
    const reservedHeight = Math.round(rect.height || 0);
    const img = document.createElement('img');
    img.src = url;
    img.alt = cardInfo(card).title || queryText() || 'Infinity Phi research image';
    img.loading = 'lazy';
    img.decoding = 'async';
    img.dataset.phiRepairImage = '1';
    img.style.display = 'block';
    img.style.width = '100%';
    img.style.objectFit = 'cover';
    if (reservedHeight > 24) img.style.height = `${reservedHeight}px`;
    fallback.replaceWith(img);
    return true;
  }

  async function wikimediaImage(term) {
    try {
      const endpoint = new URL('https://commons.wikimedia.org/w/api.php');
      endpoint.search = new URLSearchParams({
        action: 'query', generator: 'search', gsrsearch: term, gsrnamespace: '6', gsrlimit: '10',
        prop: 'imageinfo', iiprop: 'url|extmetadata', iiurlwidth: '1200', format: 'json', origin: '*'
      }).toString();
      const response = await fetch(endpoint, { cache: 'force-cache' });
      if (!response.ok) return '';
      const json = await response.json();
      const pages = Object.values(json?.query?.pages || {});
      const wanted = new Set(words(term));
      const ranked = pages.flatMap((page) => {
        const info = page?.imageinfo?.[0];
        const url = info?.thumburl || info?.url || '';
        if (!url) return [];
        const meta = info?.extmetadata || {};
        const label = clean(`${meta.ObjectName?.value || ''} ${page?.title || ''}`, 500);
        let score = 0;
        words(label).forEach((word) => { if (wanted.has(word)) score += 1; });
        if (/svg$/i.test(url) || /\.svg[?]/i.test(url)) score -= 1;
        return [{ url, score }];
      }).sort((a, b) => b.score - a.score);
      return ranked[0]?.url || '';
    } catch { return ''; }
  }

  async function openverseImage(term) {
    try {
      const endpoint = new URL('https://api.openverse.org/v1/images/');
      endpoint.search = new URLSearchParams({ q: term, page_size: '12', license: 'pdm,by,by-sa,cc0' }).toString();
      const response = await fetch(endpoint, { cache: 'force-cache' });
      if (!response.ok) return '';
      const json = await response.json();
      const wanted = new Set(words(term));
      const ranked = (json?.results || []).flatMap((item) => {
        const url = item?.thumbnail || item?.url || '';
        if (!url) return [];
        const label = clean(item?.title || '', 500);
        let score = 0;
        words(label).forEach((word) => { if (wanted.has(word)) score += 1; });
        return [{ url, score }];
      }).sort((a, b) => b.score - a.score);
      return ranked[0]?.url || '';
    } catch { return ''; }
  }

  async function findImage(card) {
    const data = cardInfo(card);
    const subject = queryText();
    const term = clean(`${subject} ${data.title}`, 700) || data.title || subject;
    const exactSource = bestExistingSourceImage(card);
    if (exactSource && overlap(`${data.title} ${data.body}`, term) > 0) return exactSource;
    const wiki = await wikimediaImage(term);
    if (wiki) return wiki;
    const openverse = await openverseImage(term);
    if (openverse) return openverse;
    return sourceImages()[0]?.url || document.querySelector('.phi-editorial-hero img')?.src || '';
  }

  async function repairMissingImages() {
    if (imagePassRunning) return;
    imagePassRunning = true;
    try {
      const cache = readJson(IMAGE_CACHE, {});
      const cards = [...document.querySelectorAll('.phi-orange-card')].slice(0, MAX_CARDS);
      for (const card of cards) {
        if (card.querySelector('.phi-orange-main img')) continue;
        if (!card.querySelector('.phi-orange-image-fallback')) continue;
        const key = cacheKey(card);
        if (cache[key] && installImage(card, cache[key])) continue;
        const found = await findImage(card);
        if (!found) continue;
        cache[key] = found;
        writeJson(IMAGE_CACHE, cache);
        installImage(card, found);
      }
    } finally {
      imagePassRunning = false;
    }
  }

  function starCoinState() {
    const session = readJson('starquest_session', null);
    const users = readJson('starquest_users', {});
    const profile = session?.key && users?.[session.key] ? users[session.key] : readJson('starquest_guest_profile_v1', {});
    return {
      tokens: Math.max(0, Number(profile?.tokens) || 0),
      pending: Math.max(0, Number(profile?.pendingShareCredits) || 0),
    };
  }

  function installWalletReadout() {
    const state = starCoinState();
    const aside = document.querySelector('aside');
    if (!aside) return;
    const unifiedButton = [...aside.querySelectorAll('button')].find((button) => /Unified wallet/i.test(button.textContent || ''));
    if (unifiedButton) {
      let badge = unifiedButton.querySelector('.phi-starcoin-menu-badge');
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'phi-starcoin-menu-badge';
        badge.dataset.phiRepairOwned = '1';
        unifiedButton.appendChild(badge);
      }
      const badgeText = `⭐ ${state.tokens} · ${state.pending}/10`;
      if (badge.textContent !== badgeText) badge.textContent = badgeText;
    }
    const walletHeading = [...aside.querySelectorAll('p')].find((node) => /Unified Infinity wallet/i.test(node.textContent || ''));
    const section = walletHeading?.closest('section');
    if (section) {
      let readout = section.querySelector('#phiStarCoinWalletReadout');
      if (!readout) {
        readout = document.createElement('div');
        readout.id = 'phiStarCoinWalletReadout';
        readout.dataset.phiRepairOwned = '1';
        walletHeading.insertAdjacentElement('afterend', readout);
      }
      const html = `<b>⭐ StarCoin</b><strong>${state.tokens}</strong><span>${state.pending}/10 shares toward the next StarCoin</span>`;
      if (readout.innerHTML !== html) readout.innerHTML = html;
    }
  }

  function installOverviewTreatment() {
    const hero = document.querySelector('.phi-editorial-hero[aria-label="AI overview"]');
    if (hero) hero.classList.add('phi-ai-overview-data-card');
  }

  function imageForSharedCard(title) {
    const wanted = clean(title, 260).toLowerCase();
    const card = [...document.querySelectorAll('.phi-orange-card')].find((node) => clean(node.querySelector('h3')?.textContent, 260).toLowerCase() === wanted);
    return card?.querySelector('.phi-orange-main img')?.src || card?.querySelector('img')?.src || '';
  }

  function patchShareWithRenderedImage() {
    if (navigator.__infinityPhiImageSharePatched || typeof navigator.share !== 'function') return;
    const previous = navigator.share.bind(navigator);
    const patched = async (data) => {
      try {
        if (data?.url) {
          const url = new URL(String(data.url), location.href);
          if (url.searchParams.has('cardTitle') && !url.searchParams.get('image')) {
            const image = imageForSharedCard(url.searchParams.get('cardTitle') || data.title || '');
            if (image) {
              url.searchParams.set('image', image);
              data = { ...data, url: url.toString() };
            }
          }
        }
      } catch {}
      return previous(data);
    };
    try {
      Object.defineProperty(navigator, 'share', { configurable: true, writable: true, value: patched });
      Object.defineProperty(navigator, '__infinityPhiImageSharePatched', { configurable: true, value: true });
    } catch {
      try { navigator.share = patched; navigator.__infinityPhiImageSharePatched = true; } catch {}
    }
  }

  function installStyles() {
    if (document.getElementById('infinityPhiRuntimeRepairStyle')) return;
    const style = document.createElement('style');
    style.id = 'infinityPhiRuntimeRepairStyle';
    style.dataset.phiRepairOwned = '1';
    style.textContent = `
      .phi-ai-overview-data-card{display:block!important;margin:18px 0 34px!important;padding:22px!important;border:1px solid #ff725f!important;border-radius:22px!important;background:linear-gradient(145deg,#c92d25,#8f1418)!important;box-shadow:0 14px 34px rgba(125,18,22,.2)!important}
      .phi-ai-overview-data-card .phi-editorial-deck{max-width:none!important;margin-top:15px!important;color:#ffe45f!important;font-family:Georgia,"Times New Roman",serif!important;font-size:clamp(1.08rem,2vw,1.35rem)!important;line-height:1.65!important}
      .phi-ai-overview-data-card .phi-identity{background:rgba(255,228,95,.13)!important;color:#ffe45f!important;border:1px solid rgba(255,228,95,.25)!important}
      .phi-starcoin-menu-badge{margin-left:auto;padding:4px 8px;border-radius:999px;background:rgba(240,189,85,.16);color:#f0bd55;font-size:.72rem;font-weight:900;white-space:nowrap}
      #phiStarCoinWalletReadout{display:grid;grid-template-columns:1fr auto;gap:3px 12px;margin:12px 0 2px;padding:14px 15px;border:1px solid rgba(240,189,85,.28);border-radius:14px;background:rgba(240,189,85,.1)}
      #phiStarCoinWalletReadout b{color:#f0bd55}#phiStarCoinWalletReadout strong{font-size:1.3rem;color:white}#phiStarCoinWalletReadout span{grid-column:1/-1;color:rgba(255,255,255,.62);font-size:.78rem}
      .phi-orange-main img[data-phi-repair-image="1"]{max-width:100%;object-position:center}
    `;
    document.head.appendChild(style);
  }

  async function process() {
    if (!onPhi() || processRunning) return;
    processRunning = true;
    try {
      installStyles();
      installOverviewTreatment();
      installWalletReadout();
      patchShareWithRenderedImage();
      await repairMissingImages();
    } finally {
      processRunning = false;
      if (rerunRequested) {
        rerunRequested = false;
        schedule();
      }
    }
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(() => { void process(); }, 220);
  }

  function mutationNeedsRepair(mutation) {
    if (mutation.type !== 'childList' || !mutation.addedNodes?.length) return false;
    for (const node of mutation.addedNodes) {
      if (node.nodeType !== 1) continue;
      const element = node;
      if (element.dataset?.phiRepairOwned === '1' || element.dataset?.phiRepairImage === '1') continue;
      if (element.id === 'infinityPhiRuntimeRepairStyle' || element.id === 'phiStarCoinWalletReadout') continue;
      if (element.matches?.('.phi-orange-card,.phi-green-card,.phi-editorial-hero,aside')) return true;
      if (element.closest?.('.phi-orange-card,.phi-green-card,.phi-editorial-hero,aside')) return true;
      if (element.querySelector?.('.phi-orange-card,.phi-green-card,.phi-editorial-hero,aside')) return true;
    }
    return false;
  }

  if (!onPhi()) return;
  void process();
  const observer = new MutationObserver((mutations) => {
    if (!mutations.some(mutationNeedsRepair)) return;
    if (processRunning) {
      rerunRequested = true;
      return;
    }
    schedule();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('starquest:share-progress', schedule);
  window.addEventListener('infinity-wallet-updated', schedule);
  window.addEventListener('focus', schedule);
  window.addEventListener('popstate', schedule);
})();
