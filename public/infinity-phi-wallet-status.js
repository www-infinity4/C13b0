(() => {
  'use strict';

  const GUEST_KEY = 'starquest_guest_profile_v1';
  const SESSION_KEY = 'starquest_session';
  const USERS_KEY = 'starquest_users';
  let lastToastSignature = '';
  let lastToastAt = 0;

  const read = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key) || 'null') || fallback; }
    catch { return fallback; }
  };

  function profile() {
    const session = read(SESSION_KEY, null);
    const users = read(USERS_KEY, {});
    if (session?.key && users?.[session.key]) return users[session.key];
    return read(GUEST_KEY, { username: 'Guest', tokens: 0, pendingShareCredits: 0, shareCount: 0 });
  }

  function snapshot() {
    const wallet = profile() || {};
    const settled = Math.max(0, Number(wallet.tokens) || 0);
    const progress = Math.max(0, Number(wallet.pendingShareCredits) || 0);
    const effective = Number((settled + progress / 10).toFixed(1));
    return {
      username: String(wallet.username || 'Guest'),
      settled,
      progress,
      effective,
      shareCount: Math.max(0, Number(wallet.shareCount) || 0),
    };
  }

  function ensureStyle() {
    if (document.getElementById('infinityPhiWalletStatusStyle')) return;
    const style = document.createElement('style');
    style.id = 'infinityPhiWalletStatusStyle';
    style.textContent = `
      #infinityPhiWalletStatus{display:inline-flex;align-items:center;gap:7px;min-height:34px;padding:6px 9px;border:1px solid rgba(255,215,74,.36);border-radius:999px;background:rgba(18,14,5,.82);color:#fff6a6;font:800 12px/1.1 system-ui,sans-serif;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.2)}
      #infinityPhiWalletStatus strong{color:#fff;font-size:13px}#infinityPhiWalletStatus small{opacity:.78;font-size:10px}
      #infinityPhiWalletStatus.phi-wallet-floating{position:fixed;right:14px;bottom:14px;z-index:10020}
      #infinityPhiWalletToast{position:fixed;left:50%;bottom:72px;z-index:10040;max-width:calc(100vw - 28px);transform:translate(-50%,18px);opacity:0;pointer-events:none;padding:10px 14px;border:1px solid rgba(255,220,79,.5);border-radius:14px;background:rgba(8,10,16,.96);color:#fff4a8;box-shadow:0 18px 55px rgba(0,0,0,.5);font:850 13px/1.35 system-ui,sans-serif;transition:opacity .2s ease,transform .2s ease;text-align:center}
      #infinityPhiWalletToast.show{opacity:1;transform:translate(-50%,0)}
    `;
    document.head.appendChild(style);
  }

  function ensureBadge() {
    ensureStyle();
    let badge = document.getElementById('infinityPhiWalletStatus');
    if (!badge) {
      badge = document.createElement('button');
      badge.id = 'infinityPhiWalletStatus';
      badge.type = 'button';
      badge.setAttribute('aria-label', 'Open StarCoin wallet');
      badge.addEventListener('click', () => {
        const control = document.getElementById('controlPhiWalletButton');
        if (control) control.click();
        else location.assign(`${location.origin}${location.pathname.replace(/\/phi(?:\/.*)?$/, '/wallet')}`);
      });
    }
    const host = document.querySelector('.phi-topline');
    if (host) {
      badge.classList.remove('phi-wallet-floating');
      if (badge.parentElement !== host) host.appendChild(badge);
    } else if (document.body && badge.parentElement !== document.body) {
      badge.classList.add('phi-wallet-floating');
      document.body.appendChild(badge);
    }
    return badge;
  }

  function render() {
    const state = snapshot();
    const badge = ensureBadge();
    if (badge) badge.innerHTML = `<span aria-hidden="true">⭐</span><strong>${state.effective.toFixed(1)}</strong><small>${state.progress}/10</small>`;
    return state;
  }

  function toast(message, signature) {
    const now = Date.now();
    if (signature && signature === lastToastSignature && now - lastToastAt < 1800) return;
    lastToastSignature = signature || message;
    lastToastAt = now;
    let node = document.getElementById('infinityPhiWalletToast');
    if (!node) {
      node = document.createElement('div');
      node.id = 'infinityPhiWalletToast';
      node.setAttribute('role', 'status');
      node.setAttribute('aria-live', 'polite');
      document.body.appendChild(node);
    }
    node.textContent = message;
    node.classList.add('show');
    clearTimeout(node.__phiWalletTimer);
    node.__phiWalletTimer = setTimeout(() => node.classList.remove('show'), 2600);
  }

  function onShareProgress(event) {
    const state = render();
    const awarded = Math.max(0, Number(event?.detail?.awarded) || 0);
    const message = awarded
      ? `Wallet grew +0.1 StarCoin · ${state.effective.toFixed(1)} ⭐ · 10-share coin completed`
      : `Wallet grew +0.1 StarCoin · ${state.effective.toFixed(1)} ⭐ · ${state.progress}/10 to next coin`;
    toast(message, `${state.settled}:${state.progress}:${state.shareCount}`);
  }

  function loadControlPhi() {
    if (window.ControlPhi || document.querySelector('script[data-infinity-phi-control]')) return;
    const script = document.createElement('script');
    script.src = 'https://www-infinity4.github.io/Control-Phi/control-phi.js?v=20260915-walletlive3';
    script.dataset.infinityPhiControl = '1';
    script.addEventListener('load', () => { try { window.ControlPhi?.refreshWallet?.(); } catch {} render(); });
    document.body.appendChild(script);
  }

  if (!/\/phi(?:\/|$)/.test(location.pathname)) return;
  const start = () => {
    render();
    loadControlPhi();
    window.addEventListener('starquest:share-progress', onShareProgress);
    window.addEventListener('controlphi:wallet-change', render);
    window.addEventListener('storage', (event) => {
      if ([GUEST_KEY, SESSION_KEY, USERS_KEY].includes(event.key || '')) render();
    });
    const observer = new MutationObserver(() => {
      if (!document.getElementById('infinityPhiWalletStatus') || !document.querySelector('.phi-topline #infinityPhiWalletStatus')) render();
    });
    if (document.body) observer.observe(document.body, { childList: true, subtree: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
