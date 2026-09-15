(() => {
  'use strict';

  const MAX_CARDS = 30;
  const STOP = new Set([
    'what','when','where','which','who','whom','whose','why','how','is','are','was','were','be','been','being','do','does','did','can','could','would','should','will',
    'the','and','for','with','from','into','about','this','that','these','those','your','their','more','most','some','many','much','have','has','had','found','find','research',
    'science','overview','question','answer','related','news','further','card','cards','infinity','phi'
  ]);

  let timer = 0;
  let running = false;
  const imageCache = new Map();

  const clean = (value, max = 3000) => String(value || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
  const onPhi = () => /\/phi(?:\/|$)/.test(location.pathname);

  function queryText() {
    try {
      const params = new URLSearchParams(location.search);
      return clean(params.get('q') || document.querySelector('.phi-search-box input')?.value || document.querySelector('.phi-identity')?.textContent || '', 500);
    } catch {
      return '';
    }
  }

  function baseSubject() {
    return clean(queryText().replace(/\s+related\s+news\s*$/i, ''), 500);
  }

  function words(value) {
    return clean(value).toLowerCase().replace(/https?:\/\/\S+/g, ' ').replace(/[^a-z0-9'-]+/g, ' ').split(/\s+/)
      .filter((word) => word.length > 1 && !STOP.has(word));
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
      title: clean(card.dataset.gptTitle || card.querySelector('h3')?.textContent, 280),
      body: clean(card.dataset.gptBody || card.querySelector('.phi-orange-copy p')?.textContent || card.querySelector('p')?.textContent, 1800),
    };
  }

  function sources() {
    return [...document.querySelectorAll('.phi-green-card')].flatMap((node) => {
      const img = node.querySelector('img');
      const url = node instanceof HTMLAnchorElement ? node.href : '';
      const title = clean(node.querySelector('b')?.textContent, 280);
      const body = clean(node.querySelector('p')?.textContent, 1600);
      if (!title && !body) return [];
      return [{ node, url, title, body, image: img?.src || '' }];
    });
  }

  function rankedSource(card) {
    const data = cardInfo(card);
    const subject = baseSubject();
    const candidates = sources().map((source) => {
      const sourceText = `${source.title} ${source.body}`;
      const score = overlap(data.title, source.title) * 4 + overlap(`${data.title} ${data.body}`, sourceText) * 3 + overlap(subject, sourceText) * 2;
      return { ...source, score };
    }).sort((a, b) => b.score - a.score);
    return candidates[0] || null;
  }

  function directScore(card) {
    const subject = baseSubject();
    const data = cardInfo(card);
    if (!subject || !data.title) return 1;
    // The generated question title always contains the subject, so it cannot
    // prove that the underlying answer is actually about that subject.
    let score = overlap(subject, data.body) * 4;
    const source = rankedSource(card);
    if (source) score += overlap(subject, `${source.title} ${source.body}`) * 2;
    return score;
  }

  function enforceRightAndNarrow() {
    [...document.querySelectorAll('.phi-orange-card')].slice(0, MAX_CARDS).forEach((card) => {
      const score = directScore(card);
      card.dataset.phiNarrowScore = String(score);
      if (score > 0) {
        if (card.dataset.phiNarrowHidden === '1') {
          card.style.removeProperty('display');
          delete card.dataset.phiNarrowHidden;
        }
        card.dataset.phiSearchScope = 'right-narrow';
        return;
      }
      card.dataset.phiSearchScope = 'out-of-scope';
      card.dataset.phiNarrowHidden = '1';
      card.style.setProperty('display', 'none', 'important');
    });
  }

  async function wikipediaImage(term) {
    const key = clean(term, 500).toLowerCase();
    if (!key) return '';
    if (imageCache.has(key)) return imageCache.get(key);
    try {
      const endpoint = new URL('https://en.wikipedia.org/w/api.php');
      endpoint.search = new URLSearchParams({
        action: 'query', generator: 'search', gsrsearch: `"${clean(term, 220)}"`, gsrlimit: '8',
        prop: 'pageimages', piprop: 'thumbnail', pithumbsize: '1000', format: 'json', origin: '*'
      }).toString();
      const response = await fetch(endpoint, { cache: 'force-cache' });
      if (!response.ok) throw new Error('image lookup failed');
      const json = await response.json();
      const pages = Object.values(json?.query?.pages || {});
      const wanted = new Set(words(term));
      const ranked = pages.flatMap((page) => {
        const url = page?.thumbnail?.source || '';
        if (!url) return [];
        const label = clean(page?.title || '', 400);
        let score = 0;
        words(label).forEach((word) => { if (wanted.has(word)) score += 1; });
        return [{ url, score }];
      }).sort((a, b) => b.score - a.score);
      const found = ranked[0]?.url || '';
      imageCache.set(key, found);
      return found;
    } catch {
      imageCache.set(key, '');
      return '';
    }
  }

  async function enforceImageBinding() {
    const cards = [...document.querySelectorAll('.phi-orange-card')].slice(0, MAX_CARDS);
    for (const card of cards) {
      const repairImage = card.querySelector('img[data-phi-repair-image="1"]');
      if (!repairImage) continue; // Never touch an image chosen by the original card pipeline.
      const source = rankedSource(card);
      if (source?.image && source.score > 0) {
        if (repairImage.src !== source.image) repairImage.src = source.image;
        continue;
      }
      const data = cardInfo(card);
      const external = await wikipediaImage(`${baseSubject()} ${data.title}`);
      if (external && repairImage.src !== external) repairImage.src = external;
    }
  }

  function patchExactShareTarget() {
    if (navigator.__infinityPhiNarrowSharePatched || typeof navigator.share !== 'function') return;
    const previous = navigator.share.bind(navigator);
    const patched = async (data) => {
      try {
        if (data?.url) {
          const url = new URL(String(data.url), location.href);
          if (url.searchParams.has('cardTitle')) {
            const subject = baseSubject();
            if (subject) {
              url.searchParams.set('q', subject);
              url.searchParams.set('run', '1');
            }
            data = { ...data, url: url.toString() };
          }
        }
      } catch {}
      return previous(data);
    };
    try {
      Object.defineProperty(navigator, 'share', { configurable: true, writable: true, value: patched });
      Object.defineProperty(navigator, '__infinityPhiNarrowSharePatched', { configurable: true, value: true });
    } catch {
      try {
        navigator.share = patched;
        navigator.__infinityPhiNarrowSharePatched = true;
      } catch {}
    }
  }

  async function process() {
    if (!onPhi() || running) return;
    running = true;
    try {
      patchExactShareTarget();
      enforceRightAndNarrow();
      await enforceImageBinding();
    } finally {
      running = false;
    }
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(() => { void process(); }, 180);
  }

  if (!onPhi()) return;
  void process();
  const observer = new MutationObserver((mutations) => {
    const relevant = mutations.some((mutation) => [...mutation.addedNodes].some((node) => {
      if (node.nodeType !== 1) return false;
      const element = node;
      return element.matches?.('.phi-orange-card,.phi-green-card') || element.querySelector?.('.phi-orange-card,.phi-green-card');
    }));
    if (relevant) schedule();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('popstate', schedule);
  window.addEventListener('focus', schedule);
})();
