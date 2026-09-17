(() => {
  'use strict';
  if (!/\/phi(?:\/|$)/.test(location.pathname)) return;
  if (window.__infinityPhiAutobuildLink) return;
  window.__infinityPhiAutobuildLink = true;

  function wire() {
    const link = document.getElementById('infinityPhiGenerateWebsite');
    if (!(link instanceof HTMLAnchorElement)) return;
    try {
      const current = new URL(link.href, location.href);
      if (!current.pathname.includes('/Omni-Phi/cards/')) return;
      current.pathname = current.pathname.replace('/Omni-Phi/cards/', '/Omni-Phi/autobuild/');
      current.searchParams.set('autobuild', '1');
      current.searchParams.set('from', 'infinity');
      link.href = current.toString();
      link.textContent = 'Generate the full website →';
      link.dataset.phiAutobuild = '1';
    } catch {}
  }

  wire();
  const observer = new MutationObserver(wire);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('infinityphi:image-selected', wire);
})();
