(() => {
  'use strict';
  if (!/\/phi(?:\/|$)/.test(location.pathname)) return;
  if (window.__infinityPhiNewsSemanticSeed) return;
  window.__infinityPhiNewsSemanticSeed = true;

  const SHARED = 'phiShared:collection:v1';
  const STOP = new Set(['about','after','again','also','and','are','because','before','being','card','cards','collected','from','have','image','images','into','more','news','only','search','selected','source','that','their','these','they','this','through','what','when','where','which','with','would','your','infinity','phi']);
  const RELATION_WORDS = new Set(['cast','actor','actors','actress','actresses','starring','director','directed','producer','studio','series','show','film','movie','musical','comedy','whimsical','fabulous','classic','magical','animation','animated','character','characters']);

  const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; } catch { return fallback; } };
  const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } };
  const clean = (value, max = 2800) => String(value || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
  const keyOf = (item) => item?.storyKey || item?.url || item?.id || clean(item?.title, 180).toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const words = (value) => clean(value).toLowerCase().replace(/https?:\/\/\S+/g, ' ').replace(/[^a-z0-9'’-]+/g, ' ').split(/\s+/).filter((word) => word.length > 2 && !STOP.has(word) && !/^\d+$/.test(word));

  function anchorsFor(record) {
    const title = clean(record?.title || record?.sourceTitle, 260);
    const query = clean(record?.searchQuery, 260);
    const body = clean(`${record?.sourceExtract || ''} ${record?.extract || ''}`, 2600);
    const original = `${title}. ${query}. ${body}`;
    const scored = new Map();
    const add = (term, weight, kind = 'word') => {
      const value = clean(term, 160).replace(/^[\s,;:.-]+|[\s,;:.-]+$/g, '');
      if (!value || value.length < 3) return;
      const key = value.toLowerCase();
      const prior = scored.get(key);
      if (!prior || weight > prior.weight) scored.set(key, { term: value, weight, kind });
    };

    if (title) add(title, 18, 'title-entity');
    if (query) add(query, 15, 'query-entity');

    for (const match of original.matchAll(/\b(?:[A-Z][A-Za-z0-9'’.-]*(?:\s+(?:of|the|and|in|on|for|to))?\s*){2,7}\b/g)) {
      add(match[0], 14, 'pronoun-phrase');
    }
    for (const match of original.matchAll(/["“]([^"”]{3,100})["”]/g)) add(match[1], 13, 'quoted-phrase');

    const bodyWords = words(original);
    bodyWords.slice(0, 90).forEach((word, index) => add(word, Math.max(3, 7 - Math.floor(index / 20)), RELATION_WORDS.has(word) ? 'relation-word' : 'word'));
    for (let i = 0; i < Math.min(bodyWords.length - 1, 70); i += 1) {
      const two = `${bodyWords[i]} ${bodyWords[i + 1]}`;
      const relation = RELATION_WORDS.has(bodyWords[i]) || RELATION_WORDS.has(bodyWords[i + 1]);
      add(two, relation ? 10 : 6, relation ? 'relation-phrase' : 'phrase');
      if (i + 2 < bodyWords.length) {
        const three = `${two} ${bodyWords[i + 2]}`;
        const relation3 = relation || RELATION_WORDS.has(bodyWords[i + 2]);
        add(three, relation3 ? 9 : 5, relation3 ? 'relation-phrase' : 'phrase');
      }
    }

    return [...scored.values()].sort((a, b) => b.weight - a.weight || b.term.length - a.term.length).slice(0, 48);
  }

  function patchShared() {
    const list = read(SHARED, []);
    if (!Array.isArray(list) || !list.length) return 0;
    let changed = 0;
    const next = list.map((record) => {
      if (!record?.selectedFromImageSearch && record?.kind !== 'image-seed' && record?.collectedFrom !== 'Infinity Phi image mode') return record;
      const anchors = anchorsFor(record);
      const updated = {
        ...record,
        storyKey: keyOf(record),
        seedOnly: true,
        ingestType: 'semantic-seed',
        semanticVersion: 1,
        semanticAnchors: anchors,
        semanticSourceText: clean(`${record?.title || ''}. ${record?.sourceExtract || ''} ${record?.extract || ''} ${record?.searchQuery || ''}`, 3200),
        generatedBy: 'infinity-phi-image-semantic-seed'
      };
      if (JSON.stringify(record.semanticAnchors || []) !== JSON.stringify(anchors) || record.ingestType !== 'semantic-seed' || !record.seedOnly) changed += 1;
      return updated;
    });
    if (changed) write(SHARED, next);
    return changed;
  }

  const schedule = () => setTimeout(() => patchShared(), 0);
  patchShared();
  window.addEventListener('controlphi:shared', schedule);
  document.addEventListener('click', (event) => {
    if (event.target?.closest?.('.phi-image-use') || event.target?.closest?.('.phi-image-builder')) schedule();
  }, true);
})();