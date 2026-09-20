(() => {
  'use strict';
  if (!/\/phi(?:\/|$)/.test(location.pathname)) return;
  if (window.__infinityPhiImageToOrange) return;
  window.__infinityPhiImageToOrange = true;

  const IMAGE_KEY = 'phiShared:imageSelections:v1';
  const NEWS_PHI = 'https://www-infinity4.github.io/News-Phi/';
  const injected = new Set();
  let timer = 0;

  const clean = (value, max = 1800) => String(value || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
  const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; } catch { return fallback; } };
  const domainOf = (value) => { try { return new URL(value).hostname.replace(/^www\./, ''); } catch { return ''; } };
  const escapeHtml = (value) => String(value || '').replace(/[&<>"']/g, (ch) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const keyOf = (record) => clean(record?.storyKey || record?.sourceUrl || record?.url || record?.image || record?.id, 1200);
  const queryText = () => { try { return clean(new URLSearchParams(location.search).get('q') || '', 320); } catch { return ''; } };

  function orangeGrid() {
    const first = document.querySelector('.phi-orange-card');
    if (!first) return null;
    return first.parentElement;
  }

  function newsUrl(record) {
    const params = new URLSearchParams({
      collect: '1',
      from: 'infinity-image',
      fromImage: '1',
      sharedTitle: clean(record.title || record.sourceTitle || 'Selected image', 220),
      sharedBody: clean(record.extract || record.sourceExtract || '', 1800),
      sharedUrl: clean(record.sourceUrl || record.url || record.image, 1200),
      sharedImage: clean(record.image || record.imageUrl, 1200),
      sharedDomain: clean(record.domain || record.provider || domainOf(record.sourceUrl || record.url), 160),
      sharedQuery: clean(record.searchQuery || queryText(), 320)
    });
    return `${NEWS_PHI}?${params.toString()}#story=${encodeURIComponent(keyOf(record))}`;
  }

  async function shareRecord(record, button) {
    const url = record.sourceUrl || record.url || record.image || location.href;
    const payload = {
      title: clean(record.title || record.sourceTitle || 'Infinity Phi image card', 220),
      text: clean(record.extract || record.sourceExtract || record.title || '', 520),
      url
    };
    try {
      if (navigator.share) {
        await navigator.share(payload);
        let credit = null;
        try { credit = await window.ControlPhi?.ensureShareCredit?.(url, 'web_share_api'); } catch {}
        button.textContent = credit?.awarded ? 'Shared · 1 StarCoin!' : credit?.progressToNextCoin != null ? `Shared · ${credit.progressToNextCoin}/10 ⭐` : 'Shared ✓';
      } else {
        await navigator.clipboard.writeText(url);
        button.textContent = 'Link copied';
      }
    } catch (error) {
      if (error?.name !== 'AbortError') button.textContent = 'Share failed · try again';
    }
  }

  async function enrichFromSource(card, record) {
    const sourceUrl = clean(record.sourceUrl || record.url || '', 1600);
    if (!sourceUrl || !/^https?:\/\//i.test(sourceUrl) || card.dataset.phiFullSourceReady === '1') return;
    card.dataset.phiFullSourceReady = 'loading';
    try {
      const parsed = new URL(sourceUrl);
      const reader = `https://r.jina.ai/http://${parsed.host}${parsed.pathname}${parsed.search}`;
      const response = await fetch(reader, { cache: 'no-store', headers: { Accept: 'text/plain' } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const fullText = clean(await response.text(), 12000);
      if (!fullText) throw new Error('empty_source');
      card.dataset.phiFullSourceText = fullText;
      card.dataset.phiFullSourceUrl = sourceUrl;
      card.dataset.phiFullSourceReady = '1';
      window.dispatchEvent(new CustomEvent('infinityphi:image-source-evidence-ready', { detail: { sourceUrl, key: keyOf(record) } }));
    } catch {
      card.dataset.phiFullSourceReady = 'fallback';
    }
  }

  function makeCard(record) {
    const key = keyOf(record);
    const sourceUrl = clean(record.sourceUrl || record.url || '', 1200);
    const image = clean(record.image || record.imageUrl || '', 1200);
    const title = clean(record.title || record.sourceTitle || 'Selected image', 220);
    const body = clean(record.extract || record.sourceExtract || `Image selected while refining ${record.searchQuery || queryText()}.`, 1500);
    const domain = clean(record.domain || record.provider || domainOf(sourceUrl) || 'Image source', 160);
    const card = document.createElement('article');
    card.className = 'phi-orange-card overflow-hidden rounded-[26px] border-2 border-orange-400 bg-gradient-to-br from-orange-500 to-red-700 text-white shadow-lg';
    card.dataset.phiImageDerivedCard = key;
    card.dataset.atomNucleus = record.searchQuery || queryText();
    card.innerHTML = `${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(title)}" class="h-44 w-full object-cover" loading="lazy">` : ''}<div class="p-5"><small class="font-black uppercase tracking-[.12em] text-yellow-200">Image refinement · ${escapeHtml(domain)}</small><h3 class="mt-2 text-xl font-black leading-tight text-yellow-100">${escapeHtml(title)}</h3><p class="mt-3 leading-6 text-orange-50">${escapeHtml(body.slice(0,520))}${body.length>520?'…':''}</p><div class="mt-4 flex flex-wrap gap-2">${sourceUrl ? `<a href="${escapeHtml(sourceUrl)}" target="_blank" rel="noopener" class="inline-flex items-center gap-1 rounded-full bg-black/25 px-3 py-2 text-xs font-black">Read source</a>` : ''}<a href="${escapeHtml(newsUrl(record))}" class="rounded-full bg-yellow-300 px-3 py-2 text-xs font-black text-red-950">Show me more · News Phi</a><button type="button" class="phi-share-card inline-flex items-center gap-1 rounded-full border border-white/40 bg-white/10 px-3 py-2 text-xs font-black">Share card · +1/10 ⭐</button></div></div>`;
    card.querySelector('img')?.addEventListener('error', (event) => { event.currentTarget.style.display='none'; }, {once:true});
    card.querySelector('.phi-share-card')?.addEventListener('click', (event) => { event.preventDefault(); event.stopPropagation(); void shareRecord(record, event.currentTarget); });
    void enrichFromSource(card, record);
    return card;
  }

  function inject(record) {
    const key = keyOf(record);
    if (!key || injected.has(key) || document.querySelector(`[data-phi-image-derived-card="${CSS.escape(key)}"]`)) return;
    const grid = orangeGrid();
    if (!grid) return;
    grid.prepend(makeCard(record));
    injected.add(key);
    window.dispatchEvent(new CustomEvent('infinityphi:image-orange-card-ready', { detail:{ key, record } }));
  }

  function restore() {
    const query = queryText().toLowerCase();
    const rows = read(IMAGE_KEY, []);
    if (!Array.isArray(rows)) return;
    rows.filter((record) => !query || !record?.searchQuery || String(record.searchQuery).toLowerCase() === query).reverse().forEach(inject);
  }

  window.addEventListener('infinityphi:image-selected', (event) => inject(event.detail));
  const schedule = () => { clearTimeout(timer); timer=setTimeout(restore,260); };
  schedule();
  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener('popstate',schedule);
})();
