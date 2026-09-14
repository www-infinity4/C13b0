(() => {
  'use strict';

  const ENDPOINT = 'https://infinity-rogers.marvaseater.workers.dev/v1/chat';
  const STORAGE_KEY = 'infinityPhiGptConversation:v1';
  let installedFor = null;

  const style = document.createElement('style');
  style.textContent = `
    .phi-gpt-button{min-height:50px;border:2px solid transparent;border-radius:999px;font-weight:950;font-size:.98rem;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:7px;background:#512da8;color:#fff;box-shadow:0 8px 22px rgba(50,22,100,.18);padding:0 14px}
    .phi-gpt-button strong{display:inline-grid;place-items:center;min-width:32px;height:28px;border:1px solid rgba(255,255,255,.75);border-radius:8px;font-size:.72rem;letter-spacing:.03em}
    .phi-gpt-button[aria-pressed="true"]{box-shadow:0 0 0 3px #fff,0 0 0 5px rgba(81,45,168,.25),0 11px 25px rgba(50,22,100,.24);background:#673ab7}
    body.phi-gpt-active .phi-front-center .phi-front-search-card{border-color:#7ce7ff!important;background:linear-gradient(145deg,#153875,#26135e)!important;box-shadow:0 20px 45px rgba(25,60,140,.26),0 0 0 4px rgba(124,231,255,.12)!important}
    body.phi-gpt-active .phi-front-center .phi-front-search-card textarea{color:#e9fbff!important;caret-color:#fff!important}
    body.phi-gpt-active .phi-front-center .phi-front-search-card textarea::placeholder{color:rgba(220,249,255,.74)!important}
    .phi-gpt-send{background:#512da8!important;color:#fff!important;font:900 .72rem/1 Arial,sans-serif!important;letter-spacing:.02em!important}
    .phi-gpt-panel{display:none;width:100%;margin:10px 0 0;border:1px solid #bfd7ef;border-radius:20px;background:#fff;box-shadow:0 18px 44px rgba(19,43,72,.16);overflow:hidden;text-align:left}
    body.phi-gpt-active .phi-gpt-panel{display:block}
    .phi-gpt-head{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:9px 12px;background:#eef7ff;border-bottom:1px solid #d7e6f3}
    .phi-gpt-head strong{color:#14233d;font-size:.86rem}.phi-gpt-head span{color:#55708f;font-size:.7rem}
    .phi-gpt-clear{border:1px solid #c6d7e7;border-radius:999px;background:#fff;color:#314c69;padding:5px 9px;font-weight:800;font-size:.7rem}
    .phi-gpt-log{max-height:min(40vh,430px);overflow:auto;padding:11px;display:grid;gap:9px;-webkit-overflow-scrolling:touch}
    .phi-gpt-message{max-width:92%;padding:10px 12px;border-radius:14px;white-space:pre-wrap;overflow-wrap:anywhere;font:500 .94rem/1.45 Arial,sans-serif}
    .phi-gpt-message.user{margin-left:auto;background:#512da8;color:#fff;border-bottom-right-radius:5px}
    .phi-gpt-message.assistant{margin-right:auto;background:#eef7ff;color:#15273a;border:1px solid #d4e6f6;border-bottom-left-radius:5px}
    .phi-gpt-message.error{background:#fff0f1;color:#8b1f2d;border-color:#f3c3c9}
    @media(max-width:720px){.phi-gpt-button{min-height:46px;font-size:.84rem;padding:0 9px}.phi-gpt-button strong{min-width:28px;height:26px;font-size:.64rem}.phi-gpt-log{max-height:43vh}}
    @media(max-width:390px){.phi-gpt-button{font-size:.76rem;padding:0 7px}.phi-gpt-button strong{display:none}}
  `;
  document.head.appendChild(style);

  function loadConversation() {
    try {
      const value = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(value) ? value.slice(-24) : [];
    } catch { return []; }
  }

  function saveConversation(value) {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value.slice(-24))); } catch {}
  }

  function setNativeValue(element, value) {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
    if (descriptor && descriptor.set) descriptor.set.call(element, value);
    else element.value = value;
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function install() {
    const front = document.querySelector('.phi-front-center');
    const form = front && front.querySelector('form.phi-front-search-card');
    const textarea = form && form.querySelector('textarea');
    const submit = form && form.querySelector('button[type="submit"]');
    if (!front || !form || !textarea || !submit || installedFor === form) return;
    installedFor = form;

    const intentButtons = [...front.querySelectorAll('button')].filter((button) => {
      const text = (button.textContent || '').trim().toLowerCase();
      return text.startsWith('search') || text.startsWith('code') || text.startsWith('create');
    });
    const buttonRow = intentButtons[0] && intentButtons[0].parentElement;
    if (!buttonRow) return;

    const gpt = document.createElement('button');
    gpt.type = 'button';
    gpt.className = 'phi-gpt-button';
    gpt.setAttribute('aria-label', 'Switch Infinity Phi search bar to GPT chat');
    gpt.setAttribute('aria-pressed', 'false');
    gpt.innerHTML = '<strong>GPT</strong><span>GPT</span>';
    buttonRow.appendChild(gpt);
    buttonRow.style.gridTemplateColumns = 'repeat(4,minmax(0,1fr))';

    const panel = document.createElement('section');
    panel.className = 'phi-gpt-panel';
    panel.setAttribute('aria-live', 'polite');
    panel.innerHTML = '<div class="phi-gpt-head"><div><strong>GPT</strong> <span>OpenAI through secure Infinity gateway</span></div><button type="button" class="phi-gpt-clear">Clear</button></div><div class="phi-gpt-log"></div>';
    form.parentElement && form.parentElement.appendChild(panel);

    const log = panel.querySelector('.phi-gpt-log');
    const clear = panel.querySelector('.phi-gpt-clear');
    let conversation = loadConversation();
    let active = false;
    let busy = false;
    const originalSubmitText = submit.textContent || '⊙';
    const originalAria = submit.getAttribute('aria-label') || 'Search with Omni Phi';
    const originalPlaceholder = textarea.getAttribute('placeholder') || 'Search anything';

    function render() {
      log.textContent = '';
      if (!conversation.length) {
        const welcome = document.createElement('div');
        welcome.className = 'phi-gpt-message assistant';
        welcome.textContent = 'GPT mode is ready. Keep the channel playing and ask your question here.';
        log.appendChild(welcome);
      } else {
        conversation.forEach((item) => {
          const node = document.createElement('div');
          node.className = `phi-gpt-message ${item.role === 'user' ? 'user' : 'assistant'}`;
          node.textContent = item.content;
          log.appendChild(node);
        });
      }
      panel.scrollTop = panel.scrollHeight;
    }

    function activate() {
      active = true;
      document.body.classList.add('phi-gpt-active');
      gpt.setAttribute('aria-pressed', 'true');
      textarea.setAttribute('placeholder', 'Message GPT…');
      textarea.setAttribute('aria-label', 'Message GPT from Infinity Phi');
      submit.textContent = 'GPT';
      submit.classList.add('phi-gpt-send');
      submit.setAttribute('aria-label', 'Send message to GPT');
      render();
      textarea.focus();
    }

    function deactivate() {
      active = false;
      document.body.classList.remove('phi-gpt-active');
      gpt.setAttribute('aria-pressed', 'false');
      textarea.setAttribute('placeholder', originalPlaceholder);
      textarea.setAttribute('aria-label', 'Search with Infinity Phi');
      submit.textContent = originalSubmitText;
      submit.classList.remove('phi-gpt-send');
      submit.setAttribute('aria-label', originalAria);
    }

    async function ask(text) {
      if (!text || busy) return;
      busy = true;
      conversation.push({ role: 'user', content: text });
      saveConversation(conversation);
      render();
      const thinking = document.createElement('div');
      thinking.className = 'phi-gpt-message assistant';
      thinking.textContent = 'GPT is thinking…';
      log.appendChild(thinking);
      panel.scrollTop = panel.scrollHeight;
      try {
        const response = await fetch(ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            input: text,
            context: {
              application: 'Infinity Phi',
              assistant: 'gpt',
              conversation: conversation.slice(-12),
              verified_context: { page: location.href, title: document.title, interface_mode: 'gpt' }
            }
          })
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.message || payload.error || `HTTP ${response.status}`);
        const answer = String(payload.output_text || payload.output || '').trim();
        if (!answer) throw new Error('empty_response');
        conversation.push({ role: 'assistant', content: answer });
        saveConversation(conversation);
        render();
      } catch (error) {
        thinking.remove();
        const node = document.createElement('div');
        node.className = 'phi-gpt-message assistant error';
        node.textContent = `GPT gateway unavailable: ${error && error.message ? error.message : 'connection failed'}.`;
        log.appendChild(node);
      } finally {
        busy = false;
        panel.scrollTop = panel.scrollHeight;
      }
    }

    gpt.addEventListener('click', activate);
    intentButtons.forEach((button) => button.addEventListener('click', deactivate));
    clear.addEventListener('click', () => {
      conversation = [];
      saveConversation(conversation);
      render();
      textarea.focus();
    });

    form.addEventListener('submit', (event) => {
      if (!active) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const text = (textarea.value || '').replace(/\s+/g, ' ').trim();
      if (!text || busy) return;
      setNativeValue(textarea, '');
      ask(text);
    }, true);

    textarea.addEventListener('keydown', (event) => {
      if (!active) return;
      if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
        event.preventDefault();
        form.requestSubmit();
      }
    }, true);

    render();
  }

  install();
  const observer = new MutationObserver(() => install());
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
