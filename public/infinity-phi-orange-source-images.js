(() => {
  'use strict';
  if (!/\/phi(?:\/|$)/.test(location.pathname)) return;
  if (window.__infinityPhiOrangeSourceImages) return;
  window.__infinityPhiOrangeSourceImages = true;

  const CACHE_PREFIX = 'infinity_phi_orange_source_image_';
  const MAX_CARDS = 16;
  const BAD = /(?:logo|favicon|avatar|sprite|icon|badge|tracking|pixel|spacer|emoji|social|share|banner-ad)/i;
  const SKIP = new Set(['the','and','for','with','from','about','into','this','that','what','when','where','which','who','why','how','are','was','were','has','have','had','your','you','its','our','source','read','card','result']);
  let running = false;
  let timer = 0;

  const clean = (value, max = 1800) => String(value || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
  const tokens = (value) => [...new Set((clean(value).toLowerCase().match(/[a-z0-9]+/g) || []).filter((word) => word.length > 2 && !SKIP.has(word)))];
  const overlap = (left, right) => { const target = new Set(tokens(right)); return tokens(left).reduce((score, word) => score + Number(target.has(word)), 0); };
  const hash = (value) => { let h=2166136261; for(const ch of String(value||'')){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);} return (h>>>0).toString(36); };

  function usable(url) {
    if (!/^https?:\/\//i.test(url || '')) return false;
    if (BAD.test(url)) return false;
    if (/\.svg(?:$|\?)/i.test(url)) return false;
    return true;
  }

  function sourceUrl(card) {
    const links = [...card.querySelectorAll('a[href^="http"]')];
    return links.find((link) => /read source/i.test(link.textContent || ''))?.href || links[0]?.href || '';
  }

  function readerUrl(url) {
    try { const parsed = new URL(url); return `https://r.jina.ai/http://${parsed.host}${parsed.pathname}${parsed.search}`; }
    catch { return ''; }
  }

  async function textFetch(url, ms = 6200) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ms);
    try {
      const response = await fetch(url, { cache:'no-store', signal:controller.signal, headers:{Accept:'text/plain'} });
      return response.ok ? await response.text() : '';
    } catch { return ''; }
    finally { clearTimeout(timeout); }
  }

  function candidates(raw, card, url) {
    const title = clean(card.querySelector('h3')?.textContent, 220);
    const body = clean(card.querySelector('p')?.textContent, 900);
    const focus = `${title} ${body}`;
    const out = [];
    const seen = new Set();
    const markdown = /!\[([^\]]{0,240})\]\((https?:\/\/[^)\s]+)\)/g;
    let match;
    let order = 0;
    while ((match = markdown.exec(String(raw || ''))) && out.length < 40) {
      const image = match[2];
      const alt = clean(match[1], 260);
      if (!usable(image)) continue;
      const key = image.replace(/[?#].*$/, '').toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const nearby = clean(String(raw || '').slice(Math.max(0, match.index - 300), match.index + 500), 700);
      const score = overlap(focus, `${alt} ${nearby}`) * 15 + overlap(title, alt) * 20 + Math.max(0, 18 - order);
      out.push({ image, alt, score, sourceUrl:url });
      order += 1;
    }
    return out.sort((a,b)=>b.score-a.score);
  }

  function cacheKey(url) { return `${CACHE_PREFIX}${hash(url)}`; }
  function readCache(url) {
    try {
      const value = JSON.parse(sessionStorage.getItem(cacheKey(url)) || 'null');
      if (!value || Date.now() - Number(value.at || 0) > 6 * 60 * 60 * 1000) return null;
      return value.item || null;
    } catch { return null; }
  }
  function saveCache(url,item){ try{sessionStorage.setItem(cacheKey(url),JSON.stringify({at:Date.now(),item}));}catch{} }

  function apply(card, item) {
    if (!item?.image || !card.isConnected) return false;
    let img = card.querySelector('img');
    if (!img) {
      img = document.createElement('img');
      img.loading = 'lazy';
      img.decoding = 'async';
      img.className = 'h-44 w-full object-cover';
      card.prepend(img);
    }
    const previous = img.src;
    img.alt = clean(item.alt || card.querySelector('h3')?.textContent || 'Source image', 220);
    img.dataset.phiSourceTruth = '1';
    img.dataset.phiSourcePage = item.sourceUrl || '';
    img.src = item.image;
    img.addEventListener('error', () => { if (previous && previous !== item.image) img.src = previous; img.dataset.phiSourceTruth='0'; }, { once:true });
    card.dataset.phiImageSourceUrl = item.sourceUrl || '';
    card.dataset.phiImageSourceImage = item.image;
    return true;
  }

  async function repairCard(card) {
    if (card.dataset.phiSourceImageChecked === '1') return;
    const url = sourceUrl(card);
    if (!url) return;
    card.dataset.phiSourceImageChecked = '1';
    const cached = readCache(url);
    if (cached?.image) { apply(card,cached); return; }
    const reader = readerUrl(url);
    if (!reader) return;
    const raw = await textFetch(reader);
    const best = candidates(raw, card, url)[0];
    if (best?.image) { saveCache(url,best); apply(card,best); }
  }

  async function refresh() {
    if (running) return;
    const cards = [...document.querySelectorAll('.phi-orange-card')].slice(0,MAX_CARDS);
    if (!cards.length) return;
    running = true;
    try { await Promise.allSettled(cards.map(repairCard)); }
    finally { running = false; }
  }

  function schedule(){ clearTimeout(timer); timer=setTimeout(()=>void refresh(),240); }
  schedule();
  const observer=new MutationObserver(schedule);
  observer.observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener('popstate',schedule);
  window.addEventListener('infinityphi:gpt-cards-ready',schedule);
})();
