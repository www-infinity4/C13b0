(() => {
  'use strict';

  if (!/\/phi(?:\/|$)/.test(location.pathname)) return;
  if (window.__infinityPhiImageModeMountFix) return;
  window.__infinityPhiImageModeMountFix = true;

  const MOUNT_ID = 'infinityPhiImageModeMount';
  const COMPAT_INPUT_ID = 'infinityPhiImageModeCompatInput';
  const HOST_ID = 'infinityPhiImageModeCompatHost';

  const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();

  function currentQuery() {
    try {
      const params = new URLSearchParams(location.search);
      return clean(
        params.get('q') ||
        document.querySelector('textarea[aria-label*="Search"][aria-label*="Infinity Phi"]')?.value ||
        document.querySelector('textarea[aria-label*="Infinity Phi"]')?.value ||
        document.querySelector('input[aria-label*="Infinity Phi"]')?.value ||
        ''
      );
    } catch {
      return '';
    }
  }

  function insertionTarget() {
    const composer = document.querySelector('textarea[aria-label*="Infinity Phi"]')?.closest('form');
    if (composer?.parentElement) return { node: composer, mode: 'after' };

    const main = document.querySelector('main');
    if (main) return { node: main, mode: 'prepend' };

    const article = document.querySelector('article');
    if (article?.parentElement) return { node: article, mode: 'before' };

    return null;
  }

  function makeMount() {
    const section = document.createElement('section');
    section.id = MOUNT_ID;
    section.setAttribute('aria-label', 'Infinity Phi image tools');
    Object.assign(section.style, {
      width: 'min(100%, 72rem)',
      margin: '10px auto 14px',
      padding: '0 12px',
      boxSizing: 'border-box',
      display: 'flex',
      justifyContent: 'flex-end',
      alignItems: 'center',
      gap: '8px',
      position: 'relative',
      zIndex: '20'
    });

    const input = document.createElement('input');
    input.id = COMPAT_INPUT_ID;
    input.type = 'text';
    input.setAttribute('aria-label', 'Search Infinity Phi');
    input.tabIndex = -1;
    input.setAttribute('aria-hidden', 'true');
    Object.assign(input.style, {
      position: 'absolute',
      width: '1px',
      height: '1px',
      opacity: '0',
      pointerEvents: 'none',
      left: '-9999px'
    });

    const host = document.createElement('div');
    host.id = HOST_ID;
    Object.assign(host.style, {
      display: 'flex',
      justifyContent: 'flex-end',
      alignItems: 'center',
      gap: '8px',
      width: '100%'
    });

    section.append(input, host);
    return section;
  }

  function placeMount(section) {
    const target = insertionTarget();
    if (!target) return false;
    if (target.mode === 'after') target.node.insertAdjacentElement('afterend', section);
    else if (target.mode === 'before') target.node.insertAdjacentElement('beforebegin', section);
    else target.node.prepend(section);
    return true;
  }

  function requestLegacyInstall() {
    window.dispatchEvent(new Event('infinity-history-updated'));
  }

  function mount() {
    const query = currentQuery();
    if (!query) return false;

    let section = document.getElementById(MOUNT_ID);
    if (!section) {
      section = makeMount();
      if (!placeMount(section)) return false;
    }

    const compatInput = document.getElementById(COMPAT_INPUT_ID);
    if (compatInput) compatInput.value = query;

    const host = document.getElementById(HOST_ID);
    if (!host) return false;

    const button = document.getElementById('infinityPhiImageModeButton');
    if (button) {
      if (button.parentElement !== host) host.appendChild(button);
      button.textContent = 'Images';
      button.title = 'Open image results and collect the images you want to use';
      button.setAttribute('aria-label', 'Open Infinity Phi image results');
      return true;
    }

    requestLegacyInstall();
    return false;
  }

  function retryMount(rounds = 20) {
    let count = 0;
    const timer = setInterval(() => {
      count += 1;
      if (mount() || count >= rounds) clearInterval(timer);
    }, 200);
  }

  retryMount(30);

  window.addEventListener('popstate', () => retryMount(16));
  window.addEventListener('infinity-history-updated', () => setTimeout(() => mount(), 0));
  document.addEventListener('submit', () => setTimeout(() => retryMount(16), 40), true);

  document.addEventListener('click', (event) => {
    const submit = event.target?.closest?.('button[type="submit"]');
    if (submit) setTimeout(() => retryMount(16), 80);
  }, true);
})();