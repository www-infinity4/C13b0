(() => {
  'use strict';
  if (!/\/phi(?:\/|$)/.test(location.pathname)) return;
  if (window.__infinityPhiImageRefinementIntent) return;
  window.__infinityPhiImageRefinementIntent = true;

  const IMAGE_INTENT = /\b(image|images|photo|photos|picture|pictures|photograph|photographs|visual|visuals)\b/i;
  let openedFor = '';
  let timer = 0;

  function query() {
    try { return String(new URLSearchParams(location.search).get('q') || '').trim(); }
    catch { return ''; }
  }

  function tune() {
    const button = document.getElementById('infinityPhiImagesButton');
    const panel = document.getElementById('infinityPhiImageExplorer');
    if (button) {
      button.textContent = 'Refine with images ∞';
      button.title = 'Search for more images related to this topic';
    }
    if (panel) {
      const kicker = panel.querySelector('.phi-image-head small');
      const heading = panel.querySelector('.phi-image-head h2');
      const status = panel.querySelector('#infinityPhiImageStatus');
      if (kicker) kicker.textContent = 'Image refinement search';
      if (heading) heading.textContent = 'Find more images related to this topic';
      if (status && !/image result|source page|ready|finding/i.test(status.textContent || '')) status.textContent = 'Selected images become evidence for orange cards, News Phi, and the purple website schematic.';
    }

    const q = query();
    if (button && q && IMAGE_INTENT.test(q) && openedFor !== q && button.getAttribute('aria-expanded') !== 'true') {
      openedFor = q;
      button.click();
      window.dispatchEvent(new CustomEvent('infinityphi:image-refinement-intent', { detail:{ query:q } }));
    }
  }

  const schedule = () => { clearTimeout(timer); timer=setTimeout(tune,180); };
  schedule();
  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener('popstate',schedule);
})();
