(() => {
  'use strict';

  if (!/\/phi(?:\/|$)/.test(location.pathname)) return;

  const STYLE_ID = 'infinityPhiCopyCaptureStyle';
  const COPY_CLASS = 'phi-tool-copy-text';

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .phi-living-result,
      .phi-living-result h1,
      .phi-living-result h2,
      .phi-living-result h3,
      .phi-living-result p,
      .phi-living-result small,
      .phi-living-result b,
      .phi-living-result strong,
      .phi-living-result .phi-orange-main,
      .phi-living-result .phi-orange-copy,
      .phi-living-result .phi-orange-copy *,
      .phi-living-result .phi-purple-main,
      .phi-living-result .phi-purple-main *,
      .phi-living-result .phi-green-card,
      .phi-living-result .phi-green-card * {
        -webkit-user-select: text !important;
        user-select: text !important;
        -webkit-touch-callout: default !important;
      }
      .phi-living-result img,
      .phi-living-result .phi-orange-image-fallback,
      .phi-living-result .phi-green-source-number {
        -webkit-user-select: none !important;
        user-select: none !important;
        -webkit-user-drag: none;
      }
      .phi-living-result .phi-orange-main,
      .phi-living-result .phi-purple-main {
        touch-action: pan-y;
      }
      .phi-living-result ::selection {
        background: rgba(255, 227, 128, .9);
        color: #111;
      }
      .phi-orange-actions > .${COPY_CLASS} {
        display: flex !important;
        align-items: center;
        justify-content: center;
        min-height: 42px;
        padding: 9px 10px !important;
        border-radius: 11px !important;
        font-size: .78rem !important;
        font-weight: 800 !important;
        text-align: center;
        line-height: 1.15;
      }
    `;
    document.head.appendChild(style);
  }

  function selectionText() {
    try { return String(window.getSelection()?.toString() || '').trim(); }
    catch { return ''; }
  }

  function clean(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function cardText(card) {
    const title = clean(card.querySelector('h3')?.textContent);
    const body = clean(card.querySelector('.phi-orange-copy p')?.textContent || card.querySelector('p')?.textContent);
    return [title, body].filter(Boolean).join('\n\n');
  }

  async function copyText(value) {
    const text = String(value || '').trim();
    if (!text) return false;
    try {
      if (navigator.clipboard?.writeText && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {}

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '0';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus({ preventScroll: true });
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    let copied = false;
    try { copied = document.execCommand('copy'); } catch {}
    textarea.remove();
    return copied;
  }

  function notify(message) {
    const existing = document.getElementById('infinityPhiCardToast');
    if (existing) {
      existing.textContent = message;
      existing.classList.add('show');
      clearTimeout(existing.__copyTimer);
      existing.__copyTimer = setTimeout(() => existing.classList.remove('show'), 1800);
      return;
    }
    const node = document.createElement('div');
    node.id = 'infinityPhiCopyToast';
    node.setAttribute('role', 'status');
    node.textContent = message;
    Object.assign(node.style, {
      position: 'fixed', left: '50%', bottom: '20px', zIndex: '100001', transform: 'translateX(-50%)',
      maxWidth: '90vw', padding: '10px 14px', borderRadius: '12px', background: '#07151f', color: '#fff',
      boxShadow: '0 12px 38px rgba(0,0,0,.3)', fontWeight: '750', textAlign: 'center'
    });
    document.body.appendChild(node);
    setTimeout(() => node.remove(), 1800);
  }

  function installCopyButton(card) {
    const actions = card.querySelector('.phi-orange-actions');
    if (!actions || actions.querySelector(`.${COPY_CLASS}`)) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `phi-card-tool ${COPY_CLASS}`;
    button.textContent = 'Copy text';
    button.setAttribute('aria-label', 'Copy this card text');
    button.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();
      const ok = await copyText(cardText(card));
      notify(ok ? 'Card text copied.' : 'Copy failed. Long-press the text to select it.');
    });
    actions.appendChild(button);
  }

  function processCards() {
    document.querySelectorAll('.phi-orange-card').forEach(installCopyButton);
  }

  // Android/Chrome can emit a normal click after a long-press text selection.
  // Do not let that click trigger the card action and destroy the selection.
  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target?.closest('.phi-orange-main, .phi-purple-main')) return;
    if (!selectionText()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);

  installStyles();
  processCards();
  new MutationObserver(() => processCards()).observe(document.documentElement, { childList: true, subtree: true });
})();
