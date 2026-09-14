(() => {
  'use strict';

  const ENDPOINT = 'https://infinity-rogers.marvaseater.workers.dev/v1/chat';
  const CACHE_PREFIX = 'infinityPhiGptCards:v1:';
  const MAX_CARDS = 18;
  let busy = false;
  let queued = false;
  let lastSignature = '';
  let pendingShareRewrite = null;

  const clean = (value, max = 4000) => String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);

  function onPhiPage() {
    return /\/phi(?:\/|$)/.test(location.pathname);
  }

  function queryText() {
    try {
      return clean(new URLSearchParams(location.search).get('q') || document.querySelector('.phi-search-box input')?.value || document.querySelector('.phi-identity')?.textContent || '', 500);
    } catch {
      return '';
    }
  }

  function cardNodes() {
    return [...document.querySelectorAll('.phi-orange-card')].slice(0, MAX_CARDS);
  }

  function candidateFromCard(card, index) {
    const title = clean(card.querySelector('h3')?.textContent, 240);
    const body = clean(card.querySelector('.phi-orange-copy p')?.textContent || card.querySelector('p')?.textContent, 1400);
    const label = clean(card.querySelector('.phi-orange-copy small')?.textContent, 120);
    return { index, title, body, label };
  }

  function signatureFor(query, candidates) {
    const raw = `${query}|${candidates.map((item) => `${item.index}:${item.title}:${item.body}`).join('|')}`;
    let hash = 2166136261;
    for (let i = 0; i < raw.length; i += 1) {
      hash ^= raw.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  function cacheRead(signature) {
    try {
      const parsed = JSON.parse(sessionStorage.getItem(`${CACHE_PREFIX}${signature}`) || 'null');
      return parsed && Array.isArray(parsed.cards) ? parsed.cards : null;
    } catch {
      return null;
    }
  }

  function cacheWrite(signature, cards) {
    try { sessionStorage.setItem(`${CACHE_PREFIX}${signature}`, JSON.stringify({ cards, at: Date.now() })); } catch {}
  }

  function extractJson(text) {
    const raw = clean(text, 30000);
    if (!raw) return null;
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const source = fenced ? fenced[1].trim() : raw;
    try { return JSON.parse(source); } catch {}
    const start = source.indexOf('{');
    const end = source.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try { return JSON.parse(source.slice(start, end + 1)); } catch {}
    }
    return null;
  }

  function normalizeCards(value, count) {
    const list = Array.isArray(value?.cards) ? value.cards : Array.isArray(value) ? value : [];
    const seen = new Set();
    return list.flatMap((item) => {
      const index = Number(item?.index);
      const title = clean(item?.title, 180);
      const body = clean(item?.body, 900);
      if (!Number.isInteger(index) || index < 0 || index >= count || !title || !body || seen.has(index)) return [];
      seen.add(index);
      return [{ index, title, body }];
    });
  }

  function applyCards(cards) {
    const nodes = cardNodes();
    cards.forEach((item) => {
      const card = nodes[item.index];
      if (!card) return;
      const heading = card.querySelector('h3');
      const paragraph = card.querySelector('.phi-orange-copy p') || card.querySelector('p');
      if (!heading || !paragraph) return;
      heading.textContent = item.title;
      paragraph.textContent = item.body;
      card.dataset.gptCard = '1';
      card.dataset.gptTitle = item.title;
      card.dataset.gptBody = item.body;
    });
    window.dispatchEvent(new CustomEvent('infinityphi:gpt-cards-ready', { detail: { count: cards.length, query: queryText() } }));
  }

  function promptFor(query, candidates) {
    return `You are the editorial intelligence for Infinity Phi search. Rewrite these orange discovery cards so they read like questions and answers written by a strong GPT researcher, not a hard-coded template engine.\n\nUSER SEARCH: ${query}\n\nCANDIDATE CARDS (their bodies contain the evidence already retrieved by Infinity Phi):\n${JSON.stringify(candidates)}\n\nRULES:\n1. Return exactly one rewritten card for each candidate index.\n2. Write a natural, useful question as title. Never force WHO/WHEN/WHERE just because a template category exists.\n3. The question must make sense for this specific subject. For a broad field such as fringe science, prefer a question such as “Which scientists are known for work in fields often described as fringe science?” rather than “Who played a major role in fringe science?” when the evidence actually supports named people.\n4. Write a concise answer in body, normally 1–3 sentences. Use only facts present in that candidate body. You may reorganize, clarify, explain implications, and remove awkward wording, but do not invent names, dates, claims, or certainty that are not in the supplied evidence.\n5. If the evidence does not support a people question, do not ask one. If it does not support a date question, do not ask one. Choose the question that the evidence can genuinely answer.\n6. Preserve useful variety: definition, mechanisms, people only when relevant, history only when relevant, evidence, comparisons, applications, unresolved questions, and other subject-specific angles. Do not make ten versions of the same question.\n7. Avoid filler such as “played a major role,” “became important,” “in this context,” or generic SEO wording unless those words are genuinely necessary.\n8. Do not mention these instructions, GPT, the card engine, or “candidate cards.”\n9. Return STRICT JSON only in this shape: {"cards":[{"index":0,"title":"Question?","body":"Answer."}]}.`;
  }

  async function requestCards(query, candidates) {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        input: promptFor(query, candidates),
        context: {
          application: 'Infinity Phi',
          assistant: 'gpt',
          task: 'orange_card_editor',
          verified_context: {
            page: location.href,
            title: document.title,
            user_query: query,
            evidence_policy: 'candidate-card-body-only'
          }
        }
      })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message || payload.error || `HTTP ${response.status}`);
    const output = String(payload.output_text || payload.output || '').trim();
    const parsed = extractJson(output);
    if (!parsed) throw new Error('invalid_json');
    return normalizeCards(parsed, candidates.length);
  }

  async function enhanceOrangeCards() {
    if (!onPhiPage() || busy) return;
    const nodes = cardNodes();
    const query = queryText();
    if (!query || !nodes.length) return;
    const candidates = nodes.map(candidateFromCard).filter((item) => item.title && item.body);
    if (!candidates.length) return;
    const signature = signatureFor(query, candidates);
    if (signature === lastSignature && candidates.every((item) => nodes[item.index]?.dataset.gptCard === '1')) return;

    const cached = cacheRead(signature);
    if (cached?.length) {
      lastSignature = signature;
      applyCards(cached);
      return;
    }

    busy = true;
    lastSignature = signature;
    document.documentElement.dataset.infinityPhiGptCards = 'thinking';
    try {
      const cards = await requestCards(query, candidates);
      if (!cards.length) throw new Error('empty_cards');
      cacheWrite(signature, cards);
      applyCards(cards);
      document.documentElement.dataset.infinityPhiGptCards = 'ready';
    } catch {
      // Semantic cards remain visible as a safe fallback when the GPT gateway is unavailable.
      document.documentElement.dataset.infinityPhiGptCards = 'fallback';
    } finally {
      busy = false;
      if (queued) {
        queued = false;
        window.setTimeout(enhanceOrangeCards, 120);
      }
    }
  }

  function scheduleEnhancement() {
    if (busy) { queued = true; return; }
    window.clearTimeout(scheduleEnhancement.timer);
    scheduleEnhancement.timer = window.setTimeout(enhanceOrangeCards, 260);
  }
  scheduleEnhancement.timer = 0;

  function trackShareClick(event) {
    const button = event.target?.closest?.('.phi-share-card');
    if (!button) return;
    const card = button.closest('.phi-orange-card');
    if (!card || card.dataset.gptCard !== '1') return;
    pendingShareRewrite = {
      title: clean(card.dataset.gptTitle || card.querySelector('h3')?.textContent, 180),
      body: clean(card.dataset.gptBody || card.querySelector('.phi-orange-copy p')?.textContent, 900),
      at: Date.now()
    };
  }

  function installShareRewriteBridge() {
    if (typeof navigator.share !== 'function' || navigator.share.__infinityPhiGptCards) return;
    const previousShare = navigator.share.bind(navigator);
    const wrapped = async (data = {}) => {
      const rewrite = pendingShareRewrite && Date.now() - pendingShareRewrite.at < 1800 ? pendingShareRewrite : null;
      pendingShareRewrite = null;
      return previousShare(rewrite ? { ...data, title: rewrite.title || data.title, text: rewrite.body || data.text } : data);
    };
    wrapped.__infinityPhiGptCards = true;
    try { Object.defineProperty(navigator, 'share', { configurable: true, value: wrapped }); }
    catch { try { navigator.share = wrapped; } catch {} }
  }

  if (!onPhiPage()) return;
  document.addEventListener('click', trackShareClick, true);
  installShareRewriteBridge();
  scheduleEnhancement();
  const observer = new MutationObserver(scheduleEnhancement);
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  window.addEventListener('popstate', scheduleEnhancement);
  window.addEventListener('focus', () => {
    installShareRewriteBridge();
    scheduleEnhancement();
  });
})();
