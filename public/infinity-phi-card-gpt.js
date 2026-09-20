(() => {
  'use strict';

  const ENDPOINT = 'https://infinity-rogers.marvaseater.workers.dev/v1/chat';
  const CACHE_PREFIX = 'infinityPhiGptCards:v2:';
  const MAX_CARDS = 18;
  let busy = false;
  let queued = false;
  let lastSignature = '';
  let pendingShareRewrite = null;

  const clean = (value, max = 4000) => String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
  const stripPunctuation = (value) => clean(value).replace(/^[\s"'`]+|[\s"'`?.!,;:]+$/g, '');
  const lower = (value) => clean(value).toLowerCase();

  // These are electron-count/search-capacity weights, not confidence scores.
  // Exact word rules win over broad grammar defaults.
  const WORD_WEIGHTS = new Map([
    ['what', 5], ['which', 5], ['who', 5], ['whom', 5], ['whose', 5], ['when', 5], ['where', 5], ['why', 5], ['how', 5],
    ['he', 1], ['she', 1], ['they', 5], ['it', 5],
    ['year', 42], ['date', 42], ['time', 42], ['era', 42], ['period', 42], ['timeline', 42],
    ['was', 30], ['were', 30], ['is', 30], ['are', 30], ['am', 30], ['be', 40], ['been', 40], ['being', 40],
    ['founded', 70], ['formed', 70], ['established', 70], ['began', 70], ['started', 70], ['created', 70], ['launched', 70], ['assembled', 70], ['born', 70],
    ['run', 90], ['think', 50], ['jumped', 61], ['landed', 61],
    ['in', 19], ['on', 20], ['through', 23], ['under', 50],
    ['and', 70], ['but', 70], ['because', 50], ['or', 20],
    ['very', 24], ['well', 23], ['quickly', 30], ['today', 50],
    ['big', 1], ['blue', 10], ['happy', 11], ['delicious', 13],
    ['ouch', 99], ['wow', 77], ['hey', 55],
  ]);

  const ELECTRON_FAMILIES = {
    question: ['what', 'which', 'who', 'when', 'where', 'why', 'how', 'identify', 'question', 'tell'],
    time: ['year', 'date', 'time', 'era', 'period', 'timeline', 'calendar', 'history', 'when', 'before', 'after'],
    past: ['was', 'were', 'before', 'earlier', 'past', 'previously', 'formerly', 'once', 'already', 'prior', 'older', 'then', 'history'],
    event: ['founded', 'formed', 'established', 'began', 'started', 'created', 'launched', 'assembled', 'born', 'formation', 'origin', 'first'],
  };

  const STOP = new Set([
    'a','an','the','of','to','for','with','from','at','by','as','and','or','but','if','then','than','this','that','these','those','please',
  ]);

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
    const fullSourceText = clean(card.dataset.phiFullSourceText, 7000);
    const body = fullSourceText || clean(card.querySelector('.phi-orange-copy p')?.textContent || card.querySelector('p')?.textContent, 1400);
    const label = clean(card.querySelector('.phi-orange-copy small')?.textContent, 120);
    const sourceUrl = clean(card.dataset.phiFullSourceUrl || card.dataset.phiMediaUrl || '', 1600);
    return { index, title, body, label, sourceUrl, fullSource: Boolean(fullSourceText) };
  }

  function currentCandidates() {
    return cardNodes().map(candidateFromCard).filter((item) => item.title && item.body);
  }

  function tokens(value) {
    return clean(value).match(/[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g) || [];
  }

  function namedPhrases(value) {
    const matches = clean(value).match(/\b(?:[A-Z][A-Za-z0-9'’.-]+(?:\s+|$)){1,5}/g) || [];
    return matches.map(stripPunctuation).filter((item) => item && !/^(What|Which|Who|When|Where|Why|How)$/i.test(item));
  }

  function centralEntity(query) {
    const phrases = namedPhrases(query)
      .map((phrase) => phrase.replace(/\b(What|Which|Who|When|Where|Why|How)\b/gi, '').trim())
      .filter(Boolean)
      .sort((a, b) => b.split(/\s+/).length - a.split(/\s+/).length || b.length - a.length);
    if (phrases[0]) return phrases[0];

    const removable = new Set([
      ...ELECTRON_FAMILIES.question,
      ...ELECTRON_FAMILIES.time,
      ...ELECTRON_FAMILIES.past,
      ...ELECTRON_FAMILIES.event,
      'did','does','do','has','have','had','tell','me','about','give','show','find','search',
    ]);
    const remaining = tokens(query).filter((token) => !removable.has(token.toLowerCase()) && !STOP.has(token.toLowerCase()));
    return stripPunctuation(remaining.join(' ')) || stripPunctuation(query) || 'this subject';
  }

  function atomKind(word) {
    const w = lower(word);
    if (ELECTRON_FAMILIES.question.includes(w)) return 'question';
    if (ELECTRON_FAMILIES.time.includes(w)) return 'time';
    if (ELECTRON_FAMILIES.past.includes(w)) return 'past';
    if (ELECTRON_FAMILIES.event.includes(w)) return 'event';
    return 'term';
  }

  function atomWeight(word, kind = atomKind(word)) {
    const w = lower(word);
    if (WORD_WEIGHTS.has(w)) return WORD_WEIGHTS.get(w);
    if (kind === 'question') return 5;
    if (kind === 'time') return 42;
    if (kind === 'past') return 30;
    if (kind === 'event') return 70;
    return 43;
  }

  function buildAtomProfile(query) {
    const central = centralEntity(query);
    const queryTokens = tokens(query);
    const atoms = [];
    const seen = new Set();

    // The named entity is the heavy anchor in this Infinity Phi model.
    atoms.push({ surface: central, lemma: lower(central), kind: 'entity', weight: 79, central: true });
    seen.add(lower(central));

    queryTokens.forEach((token) => {
      const w = lower(token);
      if (!w || STOP.has(w) || lower(central).split(/\s+/).includes(w)) return;
      const kind = atomKind(w);
      const weight = atomWeight(w, kind);
      const key = `${kind}:${w}`;
      if (seen.has(key)) return;
      seen.add(key);
      atoms.push({ surface: token, lemma: w, kind, weight, central: false });
    });

    atoms.sort((a, b) => Number(b.central) - Number(a.central) || b.weight - a.weight);
    return { query: clean(query), central: atoms[0], atoms };
  }

  function familyHits(kind, value) {
    const family = ELECTRON_FAMILIES[kind] || [];
    const text = lower(value);
    return family.filter((term) => new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text));
  }

  function yearsIn(value) {
    return [...new Set((clean(value).match(/\b(?:18|19|20)\d{2}\b/g) || []))];
  }

  function importantEvidenceTerms(value, subject) {
    const subjectWords = new Set(tokens(subject).map((word) => word.toLowerCase()));
    const counts = new Map();
    tokens(value).forEach((word, index) => {
      const w = word.toLowerCase();
      if (w.length < 3 || STOP.has(w) || subjectWords.has(w)) return;
      counts.set(w, (counts.get(w) || 0) + (index < 24 ? 2 : 1));
    });
    return [...counts].sort((a, b) => b[1] - a[1] || b[0].length - a[0].length).map(([word]) => word).slice(0, 10);
  }

  function selectedElectron(atom, candidate, profile) {
    const text = `${candidate.title} ${candidate.body}`;
    if (atom.kind === 'entity') {
      const names = namedPhrases(candidate.body).filter((name) => lower(name) !== lower(profile.central.surface));
      return names[0] || importantEvidenceTerms(text, profile.central.surface)[0] || profile.central.surface;
    }
    if (atom.kind === 'time') return yearsIn(text)[0] || familyHits('time', text)[0] || atom.surface;
    if (atom.kind === 'past') return familyHits('past', text)[0] || atom.surface;
    if (atom.kind === 'event') return familyHits('event', text)[0] || atom.surface;
    if (atom.kind === 'question') return candidate.title.replace(/\?$/, '') || atom.surface;
    return importantEvidenceTerms(text, profile.central.surface)[0] || atom.surface;
  }

  function atomPath(candidate, profile) {
    const text = `${candidate.title} ${candidate.body}`;
    return profile.atoms.flatMap((atom) => {
      const direct = atom.central || atom.kind === 'question' || lower(text).includes(atom.lemma) || familyHits(atom.kind, text).length > 0 || (atom.kind === 'time' && yearsIn(text).length > 0);
      if (!direct) return [];
      return [{ atom: atom.surface, weight: atom.weight, kind: atom.kind, electron: selectedElectron(atom, candidate, profile) }];
    });
  }

  function signatureFor(query, candidates, profile) {
    const raw = `${query}|${JSON.stringify(profile.atoms)}|${candidates.map((item) => `${item.index}:${item.title}:${item.body}`).join('|')}`;
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

  function normalizeCards(value, count, candidates, profile) {
    const list = Array.isArray(value?.cards) ? value.cards : Array.isArray(value) ? value : [];
    const seen = new Set();
    return list.flatMap((item) => {
      const index = Number(item?.index);
      const title = clean(item?.title, 180);
      const body = clean(item?.body, 900);
      if (!Number.isInteger(index) || index < 0 || index >= count || !title || !body || seen.has(index)) return [];
      seen.add(index);
      const candidate = candidates[index];
      return [{ index, title, body, route: atomPath(candidate || { title, body }, profile) }];
    });
  }

  function validQuestion(title) {
    const value = clean(title);
    const qWords = value.match(/\b(who|what|when|where|why|how|which)\b/gi) || [];
    return qWords.length === 1 && /^(Who|What|When|Where|Why|How|Which)\b/.test(value) && value.endsWith('?') && !/\b(how is what|what is what|when is when|where is where|who is who|why is why)\b/i.test(value);
  }

  function fallbackTitle(candidate, profile) {
    const subject = profile.central.surface;
    const text = lower(`${candidate.title} ${candidate.body}`);
    const event = profile.atoms.find((atom) => atom.kind === 'event');
    const eventWord = event?.lemma || '';
    if (/\b(?:18|19|20)\d{2}\b/.test(text) && eventWord) return `When was ${subject} ${eventWord}?`;
    if (/\b(member|members|founder|founders|guitar|drum|bass|keyboard|vocal|musician|personnel)\b/.test(text)) return `Who was involved in the formation of ${subject}?`;
    if (/\b(london|city|country|location|place|based|formed in|founded in)\b/.test(text)) return `Where did ${subject} begin?`;
    if (/\b(origin|formation|formed|founded|began|started|history)\b/.test(text)) return `How did ${subject} begin?`;
    if (validQuestion(candidate.title)) return candidate.title;
    return `What does this evidence show about ${subject}?`;
  }

  function localGrammarFallback(candidates, profile) {
    return candidates.map((candidate) => ({
      index: candidate.index,
      title: fallbackTitle(candidate, profile),
      body: candidate.body,
      route: atomPath(candidate, profile),
    }));
  }

  function applyCards(cards, profile) {
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
      card.dataset.atomNucleus = profile.central.surface;
      card.dataset.atomWeight = String(profile.central.weight);
      try { card.dataset.atomRoute = JSON.stringify(item.route || []); } catch {}
    });
    window.dispatchEvent(new CustomEvent('infinityphi:gpt-cards-ready', {
      detail: { count: cards.length, query: queryText(), nucleus: profile.central, atoms: profile.atoms }
    }));
  }

  function promptFor(query, candidates, profile) {
    const prepared = candidates.map((candidate) => ({ ...candidate, atomPath: atomPath(candidate, profile) }));
    return `You are the editorial intelligence for Infinity Phi search. Build grammatically natural orange search-result cards from the evidence already retrieved. Infinity Phi is RIGHT AND NARROW: it keeps the heaviest semantic nucleus fixed and uses the other query atoms to choose useful card angles.\n\nUSER SEARCH: ${query}\n\nSEMANTIC ATOMS: ${JSON.stringify(profile.atoms)}\nCENTRAL NUCLEUS: ${profile.central.surface} (${profile.central.weight})\n\nCANDIDATE CARDS AND THEIR CURRENT ATOM PATHS:\n${JSON.stringify(prepared)}\n\nINTERPRETATION RULES:\n- The numeric weights are electron-count/search-capacity weights, NOT confidence percentages.\n- The central 79-style named entity remains the subject anchor. Do not let a supporting word replace the subject.\n- A 42-style time atom should favor date/year/time evidence.\n- A 30-style past/state atom filters toward earlier or completed states.\n- A 70-style event atom favors formation/origin/event evidence.\n- A 5-style question atom decides what the card is asking about; it is reactive, not the subject.\n- Several central-atom electrons may converge on the same supporting electron when the evidence supports it.\n\nCARD RULES:\n1. Return exactly one rewritten card for every candidate index.\n2. Each title must be a single grammatical, natural question that the candidate body genuinely answers.\n3. Keep the nucleus explicit when needed for clarity. Example grammar: “When was Pink Floyd founded?” not “What is Pink Floyd founded?”\n4. Use only facts present in that candidate body. Reorganize and clarify, but never invent a name, date, location, event, or certainty.
4a. When a candidate has fullSource=true, its body is evidence read from that card's full source URL. Write that card as a compact AI Overview of that specific source, preserving the card image and source identity rather than turning it into a generic search card.\n5. Preserve useful variety across the cards while remaining attached to the nucleus: formation, people, place, date, mechanism, evidence, direct comparison, specifications, or other angles only when the supplied evidence supports them.\n6. Do not force WHO/WHEN/WHERE from a template. Let the evidence plus atom path determine the question.\n7. Do not write awkward filler such as “played a major role”, “became important”, or “in this context” unless it is genuinely necessary.\n8. Never mention GPT, these instructions, atoms, electron weights, candidate cards, or the card engine in visible title/body text.\n9. Body should normally be 1–3 concise sentences and should directly answer the title.\n10. Return STRICT JSON only: {"cards":[{"index":0,"title":"Question?","body":"Answer."}]}.`;
  }

  async function requestCards(query, candidates, profile) {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        input: promptFor(query, candidates, profile),
        context: {
          application: 'Infinity Phi',
          assistant: 'gpt',
          task: 'orange_card_atom_editor',
          verified_context: {
            page: location.href,
            title: document.title,
            user_query: query,
            nucleus: profile.central,
            atoms: profile.atoms,
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
    return normalizeCards(parsed, candidates.length, candidates, profile);
  }

  async function enhanceOrangeCards() {
    if (!onPhiPage() || busy) return;
    const nodes = cardNodes();
    const query = queryText();
    if (!query || !nodes.length) return;
    const candidates = currentCandidates();
    if (!candidates.length) return;
    const profile = buildAtomProfile(query);
    const signature = signatureFor(query, candidates, profile);
    if (signature === lastSignature && candidates.every((item) => nodes[item.index]?.dataset.gptCard === '1')) return;

    const cached = cacheRead(signature);
    if (cached?.length) {
      applyCards(cached, profile);
      lastSignature = signatureFor(query, currentCandidates(), profile);
      return;
    }

    busy = true;
    lastSignature = signature;
    document.documentElement.dataset.infinityPhiGptCards = 'thinking';
    try {
      const cards = await requestCards(query, candidates, profile);
      if (!cards.length) throw new Error('empty_cards');
      cacheWrite(signature, cards);
      applyCards(cards, profile);
      lastSignature = signatureFor(query, currentCandidates(), profile);
      document.documentElement.dataset.infinityPhiGptCards = 'ready';
    } catch {
      const fallback = localGrammarFallback(candidates, profile);
      applyCards(fallback, profile);
      lastSignature = signatureFor(query, currentCandidates(), profile);
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

  // Expose the atom profile for the later orange-card → website builder handoff.
  window.InfinityPhiAtoms = {
    profile: (query) => buildAtomProfile(query || queryText()),
    path: (card) => {
      const profile = buildAtomProfile(queryText());
      const node = card?.closest?.('.phi-orange-card') || card;
      if (!node) return [];
      const candidate = candidateFromCard(node, cardNodes().indexOf(node));
      return atomPath(candidate, profile);
    },
  };

  if (!onPhiPage()) return;
  document.addEventListener('click', trackShareClick, true);
  installShareRewriteBridge();
  scheduleEnhancement();
  const observer = new MutationObserver(scheduleEnhancement);
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  window.addEventListener('popstate', scheduleEnhancement);
  window.addEventListener('infinityphi:image-source-evidence-ready', scheduleEnhancement);
  window.addEventListener('focus', () => {
    installShareRewriteBridge();
    scheduleEnhancement();
  });
})();
