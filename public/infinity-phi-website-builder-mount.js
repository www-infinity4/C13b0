(() => {
  'use strict';
  if (!/\/phi(?:\/|$)/.test(location.pathname)) return;
  if (window.__infinityPhiWebsiteBuilderMount) return;
  window.__infinityPhiWebsiteBuilderMount = true;

  const BUTTON_ID = 'infinityPhiWebsiteBuilderButton';
  const clean = (value, max = 400) => String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);

  function queryText() {
    try { return clean(new URLSearchParams(location.search).get('q') || '', 400); }
    catch { return ''; }
  }

  function purpleSection() {
    return [...document.querySelectorAll('section')].find((section) => {
      const heading = [...section.querySelectorAll('h2')].find((node) => /purple cards/i.test(clean(node.textContent)));
      return Boolean(heading);
    }) || null;
  }

  function ensureStyle() {
    if (document.getElementById('infinity-phi-website-builder-style')) return;
    const style = document.createElement('style');
    style.id = 'infinity-phi-website-builder-style';
    style.textContent = `
      #${BUTTON_ID}{display:flex;align-items:center;justify-content:center;gap:9px;width:min(100%,760px);min-height:52px;margin:18px auto 0;border:2px solid #86efac;border-radius:18px;background:linear-gradient(135deg,#16a34a,#15803d);box-shadow:0 14px 30px rgba(21,128,61,.28);color:#fff;text-decoration:none;font:950 14px/1.15 system-ui,sans-serif;letter-spacing:.01em}
      #${BUTTON_ID}:focus-visible{outline:3px solid #fde047;outline-offset:3px}
      #${BUTTON_ID} .phi-builder-orb{display:grid;place-items:center;width:30px;height:30px;border-radius:50%;background:#dcfce7;color:#14532d;font:950 20px/1 Georgia,serif}
    `;
    document.head.appendChild(style);
  }

  function install() {
    const query = queryText();
    if (!query) return false;
    const section = purpleSection();
    if (!section) return false;
    if (document.getElementById(BUTTON_ID)) return true;
    ensureStyle();

    const link = document.createElement('a');
    link.id = BUTTON_ID;
    link.dataset.omniWebsiteBuilder = '1';
    link.href = `https://www-infinity4.github.io/Omni-Phi/cards/?${new URLSearchParams({ q: query, mode: 'search', from: 'infinity' })}`;
    link.innerHTML = '<span class="phi-builder-orb">φ</span><span>Generate website from these cards</span>';
    link.title = 'Open the Website Builder with this Infinity Phi research record';
    link.addEventListener('click', () => {
      window.dispatchEvent(new Event('infinity-history-updated'));
    });
    section.appendChild(link);
    return true;
  }

  function retry() {
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      if (install() || attempts >= 48) clearInterval(timer);
    }, 250);
  }

  retry();
  window.addEventListener('infinity-history-updated', retry);
  window.addEventListener('popstate', retry);
})();
