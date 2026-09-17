(() => {
  'use strict';
  if (!/\/phi(?:\/|$)/.test(location.pathname)) return;
  if (window.__infinityPhiPronounRefinement) return;
  window.__infinityPhiPronounRefinement = true;

  const CONTEXT_KEY = 'phiShared:semanticContext:v1';
  const REFINEMENT_KEY = 'phiShared:semanticRefinement:v1';
  const PRIOR_FETCH = window.fetch.bind(window);
  const PRONOUNS = /\b(it|its|itself|they|them|their|theirs|those|these|this|that|he|him|his|she|her|hers|there|such|same one|same ones|that one|those ones)\b/i;
  const GENERIC = new Set(['what','when','where','which','who','why','how','more','show','find','tell','give','about','value','price','history','images','image','news','story','stories','same','other','another','ones','one','that','this','those','these','they','them','their','it','its']);

  const clean = (value, max = 600) => String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
  const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; } catch { return fallback; } };
  const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} };
  const tokens = (value) => (clean(value).toLowerCase().match(/[a-z0-9]+/g) || []).filter((word) => word.length > 2 && !GENERIC.has(word));

  function queryFromLocation() {
    try { return clean(new URLSearchParams(location.search).get('q') || '', 420); }
    catch { return ''; }
  }

  function context() {
    const value = read(CONTEXT_KEY, { anchors: [], lastResolved: '', lastOriginal: '' });
    value.anchors = Array.isArray(value.anchors) ? value.anchors : [];
    return value;
  }

  function explicitEnough(query) {
    return tokens(query).length >= 2 && !PRONOUNS.test(query);
  }

  function bestAnchor(query, state) {
    const anchors = state.anchors || [];
    if (!anchors.length) return clean(state.lastResolved || state.lastOriginal, 320);
    const currentTokens = new Set(tokens(query));
    const ranked = anchors.map((anchor, index) => {
      const anchorTokens = tokens(anchor.query);
      const overlap = anchorTokens.reduce((score, word) => score + Number(currentTokens.has(word)), 0);
      return { anchor, score: overlap * 8 + Math.max(0, 12 - index) };
    }).sort((a, b) => b.score - a.score);
    return clean(ranked[0]?.anchor?.query || '', 320);
  }

  function rememberExplicit(query) {
    if (!explicitEnough(query)) return;
    const state = context();
    const key = query.toLowerCase();
    const anchors = [{ query, at: Date.now() }, ...state.anchors.filter((item) => String(item?.query || '').toLowerCase() !== key)].slice(0, 24);
    write(CONTEXT_KEY, { ...state, anchors, lastOriginal: query, lastResolved: query, updatedAt: Date.now() });
  }

  function resolve(query) {
    const original = clean(query, 420);
    if (!original) return { original, resolved: original, anchor: '', refined: false };
    const state = context();
    if (!PRONOUNS.test(original)) {
      rememberExplicit(original);
      return { original, resolved: original, anchor: original, refined: false };
    }
    const anchor = bestAnchor(original, state);
    if (!anchor || anchor.toLowerCase() === original.toLowerCase()) return { original, resolved: original, anchor: '', refined: false };
    const resolved = clean(`${anchor} — ${original}`, 620);
    const history = read(REFINEMENT_KEY, []);
    const entry = { original, resolved, anchor, at: new Date().toISOString(), source: 'pronoun-refinement' };
    write(REFINEMENT_KEY, [entry, ...(Array.isArray(history) ? history : []).filter((item) => item?.resolved !== resolved)].slice(0, 120));
    write(CONTEXT_KEY, { ...state, lastOriginal: original, lastResolved: resolved, updatedAt: Date.now() });
    window.dispatchEvent(new CustomEvent('infinityphi:semantic-refinement', { detail: entry }));
    return { original, resolved, anchor, refined: true };
  }

  function rewriteSearchUrl(rawUrl) {
    let parsed;
    try { parsed = new URL(rawUrl, location.href); } catch { return null; }
    const wikipedia = parsed.hostname === 'en.wikipedia.org' && parsed.pathname.endsWith('/w/api.php') && parsed.searchParams.get('generator') === 'search';
    if (!wikipedia) return null;
    const original = clean(parsed.searchParams.get('gsrsearch') || '', 420);
    const result = resolve(original);
    if (!result.refined || result.resolved === original) return null;
    parsed.searchParams.set('gsrsearch', result.resolved);
    parsed.searchParams.set('phiOriginalQuery', original);
    return parsed.toString();
  }

  window.InfinityPhiSemantic = Object.assign(window.InfinityPhiSemantic || {}, { resolve, context });
  window.fetch = function pronounAwareFetch(input, init) {
    const raw = typeof input === 'string' || input instanceof URL ? String(input) : input?.url || '';
    const rewritten = rewriteSearchUrl(raw);
    if (!rewritten) return PRIOR_FETCH(input, init);
    if (input instanceof Request) {
      try { return PRIOR_FETCH(new Request(rewritten, input), init); } catch { return PRIOR_FETCH(rewritten, init); }
    }
    return PRIOR_FETCH(rewritten, init);
  };

  const current = queryFromLocation();
  if (current) resolve(current);
  window.addEventListener('popstate', () => { const next = queryFromLocation(); if (next) resolve(next); });
})();
