(() => {
  'use strict';
  if (!/\/phi(?:\/|$)/.test(location.pathname)) return;
  if (window.__infinityPhiPurpleSchematicV1) return;
  window.__infinityPhiPurpleSchematicV1 = true;

  const AI_ENDPOINT = 'https://infinity-rogers.marvaseater.workers.dev/v1/chat';
  const REACTION_KEY = 'omniPhi:cardReactions:v1';
  const SHARED_KEY = 'phiShared:collection:v1';
  const IMAGE_KEY = 'phiShared:imageSelections:v1';
  const REFINEMENT_KEY = 'phiShared:semanticRefinement:v1';
  const CACHE_KEY = 'phiShared:websiteSchematic:v1';
  let timer = 0;
  let busy = false;
  let lastFingerprint = '';

  const clean = (value, max = 2400) => String(value || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
  const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; } catch { return fallback; } };
  const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} };
  const queryText = () => { try { return clean(new URLSearchParams(location.search).get('q') || '', 320); } catch { return ''; } };
  const domainOf = (value) => { try { return new URL(value).hostname.replace(/^www\./, ''); } catch { return ''; } };

  function sourceIndex() {
    const orange = [...document.querySelectorAll('.phi-orange-card')].map((card, index) => {
      const link = card.querySelector('a[href^="http"]');
      return {
        index,
        kind: 'orange',
        title: clean(card.querySelector('h3')?.textContent, 220),
        text: clean(card.querySelector('p')?.textContent, 900),
        url: clean(link?.href || '', 1200),
        domain: domainOf(link?.href || ''),
        image: clean(card.querySelector('img')?.src || '', 1200)
      };
    }).filter((item) => item.title || item.text);
    const green = [...document.querySelectorAll('.phi-green-card')].map((card, index) => ({
      index: orange.length + index,
      kind: 'green-source',
      title: clean(card.querySelector('b')?.textContent || card.querySelector('h3')?.textContent, 220),
      text: clean(card.querySelector('p')?.textContent, 900),
      url: clean(card.href || card.querySelector('a[href]')?.href || '', 1200),
      domain: domainOf(card.href || card.querySelector('a[href]')?.href || ''),
      image: clean(card.querySelector('img')?.src || '', 1200)
    })).filter((item) => item.title || item.text);
    return [...orange, ...green].slice(0, 30);
  }

  function positiveHistory() {
    const reactions = read(REACTION_KEY, []);
    const shared = read(SHARED_KEY, []);
    const refinements = read(REFINEMENT_KEY, []);
    const reactionRows = (Array.isArray(reactions) ? reactions : []).filter((event) => Number(event?.weight || 0) > 0).slice(0, 160).map((event) => ({
      type: 'interaction', title: clean(event.title, 220), query: clean(event.query, 220), action: clean(event.action, 40), weight: Number(event.weight || 0), domain: clean(event.domain, 120), at: event.at || ''
    }));
    const collectedRows = (Array.isArray(shared) ? shared : []).slice(0, 100).map((item) => ({
      type: item?.kind === 'image-seed' ? 'image-choice' : 'collected', title: clean(item?.title || item?.sourceTitle, 220), query: clean(item?.searchQuery, 220), domain: clean(item?.domain || item?.provider, 120), url: clean(item?.url, 1000), at: item?.collectedAt || ''
    }));
    const refinementRows = (Array.isArray(refinements) ? refinements : []).slice(0, 80).map((item) => ({
      type: 'pronoun-refinement', original: clean(item?.original, 220), anchor: clean(item?.anchor, 220), resolved: clean(item?.resolved, 420), at: item?.at || ''
    }));
    return [...reactionRows, ...collectedRows, ...refinementRows].slice(0, 260);
  }

  function imageChoices() {
    const rows = read(IMAGE_KEY, []);
    return (Array.isArray(rows) ? rows : []).slice(0, 50).map((item) => ({
      title: clean(item?.title, 220), query: clean(item?.searchQuery, 220), image: clean(item?.image || item?.imageUrl, 1200), sourceUrl: clean(item?.sourceUrl || item?.url, 1200), domain: clean(item?.domain || item?.provider, 120)
    }));
  }

  function findOldPurple() {
    const heading = [...document.querySelectorAll('h2')].find((node) => clean(node.textContent).toLowerCase() === 'purple cards');
    return heading?.closest('section') || null;
  }

  function orangeSection() {
    return document.querySelector('.phi-orange-card')?.closest('section') || null;
  }

  function ensureStyles() {
    if (document.getElementById('infinity-purple-schematic-style')) return;
    const style = document.createElement('style');
    style.id = 'infinity-purple-schematic-style';
    style.textContent = `
      #infinityPhiPurpleSchematic{border-radius:30px;background:linear-gradient(145deg,#2e1065,#581c87 56%,#701a75);padding:20px;color:white;box-shadow:0 20px 52px rgba(46,16,101,.26)}
      #infinityPhiPurpleSchematic .ips-head{display:flex;justify-content:space-between;align-items:flex-end;gap:12px;flex-wrap:wrap;margin-bottom:14px}#infinityPhiPurpleSchematic .ips-kicker{font:950 11px/1 system-ui,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:#f0abfc}#infinityPhiPurpleSchematic h2{margin:4px 0 0;font:950 26px/1.05 system-ui,sans-serif}#infinityPhiPurpleSchematic .ips-status{max-width:460px;color:#e9d5ff;font:700 12px/1.4 system-ui,sans-serif}.ips-grid{display:grid;grid-template-columns:1fr;gap:12px}.ips-card{border:1px solid rgba(240,171,252,.35);border-radius:20px;background:rgba(255,255,255,.09);padding:16px}.ips-card[data-layer="1"]{background:linear-gradient(145deg,rgba(76,29,149,.9),rgba(107,33,168,.8))}.ips-card[data-layer="2"]{background:linear-gradient(145deg,rgba(88,28,135,.88),rgba(126,34,206,.72))}.ips-card[data-layer="3"]{background:linear-gradient(145deg,rgba(112,26,117,.9),rgba(134,25,143,.72))}.ips-label{font:950 10px/1 system-ui,sans-serif;letter-spacing:.13em;text-transform:uppercase;color:#f5d0fe}.ips-card h3{margin:8px 0 7px;font:950 19px/1.15 system-ui,sans-serif}.ips-card p{margin:0;color:#f3e8ff;font:650 13px/1.55 system-ui,sans-serif}.ips-detail{display:grid;gap:7px;margin-top:12px}.ips-row{display:grid;grid-template-columns:minmax(110px,.32fr) 1fr;gap:9px;border-top:1px solid rgba(255,255,255,.1);padding-top:7px}.ips-row b{color:#f0abfc;font:900 11px/1.3 system-ui,sans-serif}.ips-row span{color:#fff;font:700 12px/1.4 system-ui,sans-serif}.ips-tags{display:flex;gap:6px;flex-wrap:wrap}.ips-tag{border:1px solid rgba(255,255,255,.18);border-radius:999px;background:rgba(0,0,0,.14);padding:5px 8px;font:800 10px/1 system-ui,sans-serif}.ips-loading{border:1px dashed rgba(240,171,252,.5);border-radius:18px;padding:18px;color:#e9d5ff;font:800 13px/1.5 system-ui,sans-serif}@media(min-width:860px){.ips-grid{grid-template-columns:repeat(3,1fr)}.ips-card{min-height:360px}.ips-row{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function ensureSection() {
    ensureStyles();
    let section = document.getElementById('infinityPhiPurpleSchematic');
    if (section) return section;
    const orange = orangeSection();
    if (!orange) return null;
    section = document.createElement('section');
    section.id = 'infinityPhiPurpleSchematic';
    section.innerHTML = `<div class="ips-head"><div><div class="ips-kicker">Website schematic</div><h2>Purple cards</h2></div><div class="ips-status" id="infinityPhiPurpleStatus">Building identity → system → content from your interactions and selected images…</div></div><div class="ips-grid" id="infinityPhiPurpleGrid"><div class="ips-loading">Reading cross-search interaction consensus before deciding what the website should become.</div></div>`;
    orange.insertAdjacentElement('afterend', section);
    const old = findOldPurple();
    if (old && old !== section) old.style.display = 'none';
    return section;
  }

  function tags(items) {
    return `<div class="ips-tags">${(Array.isArray(items) ? items : []).filter(Boolean).slice(0, 12).map((item) => `<span class="ips-tag">${escapeHtml(clean(item, 120))}</span>`).join('')}</div>`;
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  }

  function detail(label, value) {
    if (Array.isArray(value)) return value.length ? `<div class="ips-row"><b>${escapeHtml(label)}</b>${tags(value)}</div>` : '';
    const text = clean(value, 900);
    return text ? `<div class="ips-row"><b>${escapeHtml(label)}</b><span>${escapeHtml(text)}</span></div>` : '';
  }

  function fallback(query, sources) {
    const titles = sources.slice(0, 6).map((item) => item.title).filter(Boolean);
    return {
      identity: { businessName: `${query} Index`, siteName: `${query} Index`, domainSuggestion: `${query.toLowerCase().replace(/[^a-z0-9]+/g, '') || 'index'}.com`, focus: query, uniqueIdentifiers: titles.slice(0, 5), logoMonogram: query.split(/\s+/).map((word) => word[0]).join('').slice(0, 4).toUpperCase(), logoPrompt: `Professional publication mark for ${query}`, layoutFamily: 'editorial-index' },
      system: { family: 'editorial-index', navigation: ['Home','Index','Stories','Sources'], views: ['cards','list','story'], filters: [], indicators: [], dataRefresh: 'Source-driven', responsive: 'mobile-first', hamburger: true },
      content: { contentTypes: ['source-backed stories','image-led cards','source index'], modules: ['search','story cards','citations'], visualTools: ['selected source images'], storySections: titles },
      cards: [
        { layer:1, title:'Identity · business, brand and purpose', instruction:'Define the site identity from repeated interaction consensus rather than copying one story.' },
        { layer:2, title:'System · layout, navigation and data behavior', instruction:'Define the actual website layout, controls, views, filters and update behavior.' },
        { layer:3, title:'Content · stories, modules and visual components', instruction:'Define how the evidence becomes articles, images, cards, plugins, graphs and other website components.' }
      ],
      consensus: 'Fallback schematic from current evidence.'
    };
  }

  function parseJson(text) {
    const raw = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start < 0 || end <= start) throw new Error('schematic_json_invalid');
    return JSON.parse(raw.slice(start, end + 1));
  }

  async function askSchematic(query, sources, history, images) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 24000);
    const prompt = [
      'Build exactly THREE purple WEBSITE SCHEMATIC cards for Infinity Phi.',
      `Current query: ${query}`,
      'These purple cards are NOT summaries, related searches, or another article. The orange/source material remains the factual content.',
      'Use positive interactions across searches to infer consensus. Example only: repeated interactions with Morgan dollars, Wheat cents, Indian Head cents and Buffalo nickels can imply a broader old-coin/numismatic focus even though the words differ. Do not use that example unless the actual signals support it.',
      'Image-search selections happen before this schematic. Treat selected image subjects and source URLs as visual/content design signals while preserving provenance.',
      'Pronoun-resolved refined searches are continuations of an antecedent topic, not fresh unrelated searches.',
      'CARD 1 / IDENTITY: infer business/site purpose, business name, publication/site name, suggested domain (suggestion only, never claim ownership), focus, unique identifiers from the content, generated logo monogram, logo-generation prompt, and semantic layout family.',
      'CARD 2 / SYSTEM: choose how the page actually behaves: hamburger, navigation, pages, list/table/card/story views, filters/dropdowns, search/refinement controls, value/pricing indicators when appropriate, update cadence, responsive layout, and other technical structure. This chooses the forms CARD 3 may use.',
      'CARD 3 / CONTENT: mold the evidence into the selected forms: article/story sections, differently sized content cards, target source images, citations, plugins, applications, mechanical widgets/spinners, graphs, generated images, and design-focused modules. Do not merely repeat titles from above.',
      'Interactions tell you emphasis and purpose; they are not factual evidence. Use source records for factual content.',
      'Return JSON only:',
      '{"identity":{"businessName":"...","siteName":"...","domainSuggestion":"...","focus":"...","uniqueIdentifiers":["..."],"logoMonogram":"...","logoPrompt":"...","layoutFamily":"..."},"system":{"family":"...","navigation":["..."],"hamburger":true,"views":["..."],"filters":["..."],"indicators":["..."],"dataRefresh":"...","responsive":"..."},"content":{"contentTypes":["..."],"modules":["..."],"visualTools":["..."],"storySections":["..."]},"cards":[{"layer":1,"title":"...","instruction":"..."},{"layer":2,"title":"...","instruction":"..."},{"layer":3,"title":"...","instruction":"..."}],"consensus":"short explanation"}',
      `Cross-search positive interaction history: ${JSON.stringify(history)}`,
      `Selected image refinements: ${JSON.stringify(images)}`,
      `Current source material: ${JSON.stringify(sources)}`
    ].join('\n');
    try {
      const response = await fetch(AI_ENDPOINT, { method:'POST', headers:{'Content-Type':'application/json',Accept:'application/json'}, signal:controller.signal, body:JSON.stringify({input:prompt,context:{application:'Infinity Phi',assistant:'three-purple-schematic',task:'website-schematic-v1'}}) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || payload.error || `HTTP ${response.status}`);
      return parseJson(payload.output_text || payload.output || payload.answer || '');
    } finally { clearTimeout(timeout); }
  }

  function render(result, query) {
    const section = ensureSection();
    if (!section) return;
    const grid = section.querySelector('#infinityPhiPurpleGrid');
    const status = section.querySelector('#infinityPhiPurpleStatus');
    if (!grid) return;
    const identity = result.identity || {};
    const system = result.system || {};
    const content = result.content || {};
    const cards = Array.isArray(result.cards) ? result.cards : [];
    const descriptions = [cards.find((card) => Number(card.layer) === 1)?.instruction, cards.find((card) => Number(card.layer) === 2)?.instruction, cards.find((card) => Number(card.layer) === 3)?.instruction];
    grid.innerHTML = `
      <article class="ips-card" data-layer="1"><div class="ips-label">Purple 1 · Identity</div><h3>${escapeHtml(cards[0]?.title || 'Identity · business, brand and purpose')}</h3><p>${escapeHtml(clean(descriptions[0] || 'Define what the website is before deciding how it looks.', 900))}</p><div class="ips-detail">${detail('Business',identity.businessName)}${detail('Website',identity.siteName)}${detail('Domain idea',identity.domainSuggestion)}${detail('Focus',identity.focus)}${detail('Logo mark',identity.logoMonogram)}${detail('Logo design',identity.logoPrompt)}${detail('Identifiers',identity.uniqueIdentifiers)}${detail('Layout family',identity.layoutFamily)}</div></article>
      <article class="ips-card" data-layer="2"><div class="ips-label">Purple 2 · System</div><h3>${escapeHtml(cards[1]?.title || 'System · layout, navigation and data behavior')}</h3><p>${escapeHtml(clean(descriptions[1] || 'Choose the technical structure that fits the identity.', 900))}</p><div class="ips-detail">${detail('Family',system.family)}${detail('Navigation',system.navigation)}${detail('Views',system.views)}${detail('Filters',system.filters)}${detail('Indicators',system.indicators)}${detail('Refresh',system.dataRefresh)}${detail('Responsive',system.responsive)}${detail('Hamburger',system.hamburger === false ? 'No' : 'Yes')}</div></article>
      <article class="ips-card" data-layer="3"><div class="ips-label">Purple 3 · Content</div><h3>${escapeHtml(cards[2]?.title || 'Content · stories, modules and visual components')}</h3><p>${escapeHtml(clean(descriptions[2] || 'Mold the evidence into the component types selected by the system layer.', 900))}</p><div class="ips-detail">${detail('Content types',content.contentTypes)}${detail('Modules',content.modules)}${detail('Visual tools',content.visualTools)}${detail('Story sections',content.storySections)}</div></article>`;
    if (status) status.textContent = clean(result.consensus || `Three-layer schematic ready for ${query}. Selected images and interaction consensus feed these cards before website generation.`, 600);
    write(CACHE_KEY, { query, result, updatedAt:new Date().toISOString() });
    window.dispatchEvent(new CustomEvent('infinityphi:purple-schematic-ready', { detail:{ query, result } }));
  }

  async function refresh(force = false) {
    const query = queryText();
    const sources = sourceIndex();
    if (!query || !sources.length || busy) return;
    ensureSection();
    const history = positiveHistory();
    const images = imageChoices();
    const fingerprint = `${query}|${history[0]?.at || ''}|${history.length}|${images.length}|${sources.map((item) => `${item.title}:${item.url}`).join('|')}`;
    if (!force && fingerprint === lastFingerprint) return;
    lastFingerprint = fingerprint;
    const cached = read(CACHE_KEY, null);
    if (!force && cached?.query === query && cached?.fingerprint === fingerprint && cached?.result) { render(cached.result, query); return; }
    busy = true;
    const status = document.getElementById('infinityPhiPurpleStatus');
    if (status) status.textContent = 'Building cross-search consensus into identity → system → content…';
    let result;
    try { result = await askSchematic(query, sources, history, images); }
    catch (error) { console.warn('Infinity purple schematic fallback:', error); result = fallback(query, sources); }
    finally { busy = false; }
    write(CACHE_KEY, { query, fingerprint, result, updatedAt:new Date().toISOString() });
    render(result, query);
  }

  const schedule = (force = false) => {
    clearTimeout(timer);
    timer = setTimeout(() => void refresh(force), force ? 80 : 900);
  };

  schedule();
  const observer = new MutationObserver(() => schedule(false));
  observer.observe(document.documentElement, { childList:true, subtree:true });
  document.addEventListener('click', (event) => { if (event.target?.closest?.('.phi-orange-card')) schedule(true); }, true);
  window.addEventListener('infinityphi:image-selected', () => schedule(true));
  window.addEventListener('infinityphi:semantic-refinement', () => schedule(true));
  window.addEventListener('popstate', () => schedule(true));
})();
