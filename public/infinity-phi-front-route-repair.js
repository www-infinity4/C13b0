(() => {
  'use strict';
  if (!/\/phi(?:\/|$)/.test(location.pathname)) return;
  try {
    const url = new URL(location.href);
    const q = (url.searchParams.get('q') || '').trim();
    const sharedTitle = (url.searchParams.get('cardTitle') || url.searchParams.get('sharedTitle') || '').trim();
    const id = (url.searchParams.get('id') || '').trim();

    if (!q && sharedTitle) {
      url.searchParams.set('q', sharedTitle);
      url.searchParams.set('run', '1');
      history.replaceState(history.state, '', `${url.pathname}${url.search}${url.hash}`);
      return;
    }

    if (!q && !id && url.searchParams.has('run')) {
      url.searchParams.delete('run');
      history.replaceState(history.state, '', `${url.pathname}${url.search}${url.hash}`);
    }
  } catch {}
})();
