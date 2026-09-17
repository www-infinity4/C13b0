(() => {
  'use strict';

  const GUEST_KEY = 'starquest_guest_profile_v1';
  const SESSION_KEY = 'starquest_session';
  const USERS_KEY = 'starquest_users';
  let lastToastSignature = '';
  let lastToastAt = 0;
  let lastObservedShareCount = null;
  let activeShareButton = null;

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
      #infinityPhiWalletToast{position:fixed;left:50%;bottom:72px;z-index:10040;max-width:calc(100vw - 28px);transform:translate(-50%,18px);opacity:0;pointer-events:none;padding:12px 16px;border:1px solid rgba(255,220,79,.62);border-radius:14px;background:rgba(8,10,16,.97);color:#fff4a8;box-shadow:0 18px 55px rgba(0,0,0,.55);font:900 14px/1.35 system-ui,sans-serif;transition:opacity .2s ease,transform .2s ease;text-align:center}
      #infinityPhiWalletToast.show{opacity:1;transform:translate(-50%,0)}
      #infinityPhiStarCoinMenuButton{width:100%;display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:10px;min-height:58px;margin:2px 0 8px;padding:10px 12px;border:1px solid rgba(255,221,89,.45);border-radius:14px;background:linear-gradient(135deg,rgba(121,83,10,.55),rgba(28,22,8,.9));color:#fff;text-align:left;cursor:pointer;font:800 12px/1.2 system-ui,sans-serif}
      #infinityPhiStarCoinMenuButton .phi-star-icon{font-size:20px}#infinityPhiStarCoinMenuButton .phi-star-copy{display:grid;gap:3px}#infinityPhiStarCoinMenuButton .phi-star-copy strong{font-size:14px}#infinityPhiStarCoinMenuButton .phi-star-copy small{font-size:10px;color:#e8d78a}#infinityPhiStarCoinMenuButton .phi-star-value{display:grid;justify-items:end;gap:3px}#infinityPhiStarCoinMenuButton .phi-star-value strong{font-size:14px;color:#fff4a8}#infinityPhiStarCoinMenuButton .phi-star-value small{font-size:10px;color:#e8d78a}
      .phi-share-card[data-starcoin-confirmed="1"]{border-color:#fff2a8!important;background:rgba(20,92,53,.72)!important;color:#fffbd2!important}
    `;
    document.head.appendChild(style);
  }

  function loadControlPhi() {
    if (window.ControlPhi || document.querySelector('script[data-infinity-phi-control]')) return;
    const script = document.createElement('script');
    script.src = 'https://www-infinity4.github.io/Control-Phi/control-phi.js?v=20260916-walletmenu4';
    script.dataset.infinityPhiControl = '1';
    script.addEventListener('load', () => { try { window.ControlPhi?.refreshWallet?.(); } catch {} render(); });
    document.body.appendChild(script);
  }

  function openStarCoinWallet() {
    const open = () => {
      const control = document.getElementById('controlPhiWalletButton');
      if (!control) return false;
      control.click();
      return true;
    };
    if (open()) return;
    loadControlPhi();
    window.setTimeout(() => { if (!open()) window.setTimeout(open, 700); }, 180);
  }

  function ensureBadge() {
    ensureStyle();
    let badge = document.getElementById('infinityPhiWalletStatus');
    if (!badge) {
      badge = document.createElement('button');
      badge.id = 'infinityPhiWalletStatus';
      badge.type = 'button';
      badge.setAttribute('aria-label', 'Open StarCoin wallet');
      badge.addEventListener('click', openStarCoinWallet);
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

  function findHamburgerNav() {
    const links = [...document.querySelectorAll('aside nav a')];
    const home = links.find((link) => /Infinity\s*(?:φ|Phi)\s*home/i.test(link.textContent || ''));
    return home?.parentElement || null;
  }

  function ensureMenuWallet() {
    const nav = findHamburgerNav();
    if (!nav) return null;
    let item = document.getElementById('infinityPhiStarCoinMenuButton');
    if (!item) {
      item = document.createElement('button');
      item.id = 'infinityPhiStarCoinMenuButton';
      item.type = 'button';
      item.setAttribute('aria-label', 'Open Star Coin wallet');
      item.innerHTML = '<span class="phi-star-icon" aria-hidden="true">⭐</span><span class="phi-star-copy"><strong>Star Coin wallet</strong><small>Every share adds 1/10 Star Coin</small></span><span class="phi-star-value"><strong data-phi-star-balance>0.0 ⭐</strong><small data-phi-star-progress>0/10</small></span>';
      item.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        openStarCoinWallet();
      });
    }
    if (item.parentElement !== nav) nav.prepend(item);
    return item;
  }

  function render() {
    const state = snapshot();
    const badge = ensureBadge();
    if (badge) badge.innerHTML = `<span aria-hidden="true">⭐</span><strong>${state.effective.toFixed(1)}</strong><small>${state.progress}/10</small>`;
    const menu = ensureMenuWallet();
    if (menu) {
      const balance = menu.querySelector('[data-phi-star-balance]');
      const progress = menu.querySelector('[data-phi-star-progress]');
      if (balance) balance.textContent = `${state.effective.toFixed(1)} ⭐`;
      if (progress) progress.textContent = `${state.progress}/10`;
    }
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
      node.setAttribute('aria-live', 'assertive');
      document.body.appendChild(node);
    }
    node.textContent = message;
    node.classList.add('show');
    clearTimeout(node.__phiWalletTimer);
    node.__phiWalletTimer = setTimeout(() => node.classList.remove('show'), 4200);
  }

  function markShareButton(state, awarded) {
    const button = activeShareButton && activeShareButton.isConnected ? activeShareButton : null;
    if (!button) return;
    button.dataset.starcoinConfirmed = '1';
    button.textContent = awarded
      ? `✓ Shared · +0.1 Star Coin · ${state.effective.toFixed(1)} ⭐`
      : `✓ Shared · +0.1 Star Coin · ${state.progress}/10`;
  }

  function announceReceipt(detail = {}) {
    const state = render();
    const awarded = Math.max(0, Number(detail.awarded) || 0);
    const message = awarded
      ? `✓ Shared · +0.1 Star Coin added to wallet · ${state.effective.toFixed(1)} ⭐ total`
      : `✓ Shared · +0.1 Star Coin added to wallet · ${state.progress}/10 toward the next full coin`;
    markShareButton(state, awarded);
    toast(message, `${state.shareCount}:${state.settled}:${state.progress}`);
    lastObservedShareCount = state.shareCount;
  }

  function onShareProgress(event) {
    announceReceipt(event?.detail || {});
  }

  function watchForMissedReceipt() {
    const state = snapshot();
    if (lastObservedShareCount === null) {
      lastObservedShareCount = state.shareCount;
      return;
    }
    if (state.shareCount > lastObservedShareCount) {
      announceReceipt({ awarded: 0 });
    } else {
      lastObservedShareCount = state.shareCount;
      render();
    }
  }

  if (!/\/phi(?:\/|$)/.test(location.pathname)) return;
  const start = () => {
    const initial = render();
    lastObservedShareCount = initial.shareCount;
    loadControlPhi();
    document.addEventListener('pointerdown', (event) => {
      const button = event.target?.closest?.('.phi-share-card');
      if (button) activeShareButton = button;
    }, true);
    window.addEventListener('starquest:share-progress', onShareProgress);
    window.addEventListener('controlphi:wallet-change', render);
    window.addEventListener('storage', (event) => {
      if ([GUEST_KEY, SESSION_KEY, USERS_KEY].includes(event.key || '')) render();
    });
    const observer = new MutationObserver(() => {
      if (!document.getElementById('infinityPhiWalletStatus') || !document.getElementById('infinityPhiStarCoinMenuButton')) render();
    });
    if (document.body) observer.observe(document.body, { childList: true, subtree: true });
    window.setInterval(watchForMissedReceipt, 900);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
