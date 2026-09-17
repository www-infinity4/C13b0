(() => {
  'use strict';

  if (!/\/phi(?:\/|$)/.test(location.pathname)) return;
  if (window.__infinityPhiExactCardShare) return;
  window.__infinityPhiExactCardShare = true;

  let pending = null;
  const clean = (value, max = 1800) => String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);

  function cardData(card) {
    return {
      title: clean(card?.dataset?.gptTitle || card?.querySelector('h3')?.textContent || 'Infinity Phi card', 180),
      body: clean(card?.dataset?.gptBody || card?.querySelector('.phi-orange-copy p')?.textContent || card?.querySelector('p')?.textContent || '', 700),
      label: clean(card?.querySelector('.phi-orange-copy small')?.textContent || card?.querySelector('small')?.textContent || 'Infinity Phi', 100),
      image: card?.querySelector('.phi-orange-main img')?.src || card?.querySelector('img')?.src || '',
    };
  }

  function cardUrl(data) {
    const url = new URL(location.href);
    url.pathname = url.pathname.replace(/\/phi(?:\/.*)?$/, '/phi/');
    url.search = '';
    url.hash = '';
    url.searchParams.set('cardTitle', data.title);
    url.searchParams.set('cardBody', data.body);
    if (data.image) url.searchParams.set('image', data.image);
    return url.toString();
  }

  function roundedRect(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
  }

  function wrapLines(ctx, text, maxWidth, maxLines) {
    const words = clean(text, 3000).split(/\s+/).filter(Boolean);
    const lines = [];
    let line = '';
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width <= maxWidth) {
        line = next;
      } else {
        if (line) lines.push(line);
        line = word;
        if (lines.length >= maxLines) break;
      }
    }
    if (line && lines.length < maxLines) lines.push(line);
    if (words.length && lines.length === maxLines) {
      const last = lines.length - 1;
      while (ctx.measureText(`${lines[last]}…`).width > maxWidth && lines[last].length > 4) lines[last] = lines[last].slice(0, -2).trim();
      lines[last] = `${lines[last].replace(/[.,;:!?]+$/, '')}…`;
    }
    return lines;
  }

  async function loadImage(url) {
    if (!/^https?:\/\//i.test(url || '')) return null;
    try {
      const response = await fetch(url, { cache: 'force-cache', mode: 'cors' });
      if (!response.ok) return null;
      const blob = await response.blob();
      if (!/^image\//i.test(blob.type)) return null;
      const objectUrl = URL.createObjectURL(blob);
      try {
        const image = await new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = objectUrl;
        });
        return image;
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    } catch { return null; }
  }

  function drawCover(ctx, image, x, y, width, height) {
    const scale = Math.max(width / image.width, height / image.height);
    const sw = width / scale;
    const sh = height / scale;
    const sx = Math.max(0, (image.width - sw) / 2);
    const sy = Math.max(0, (image.height - sh) / 2);
    ctx.drawImage(image, sx, sy, sw, sh, x, y, width, height);
  }

  async function renderCard(card) {
    const data = cardData(card);
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 675;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const bg = ctx.createLinearGradient(0, 0, 1200, 675);
    bg.addColorStop(0, '#f28b22');
    bg.addColorStop(1, '#c95f12');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 1200, 675);

    ctx.fillStyle = '#081d2f';
    roundedRect(ctx, 42, 40, 1116, 595, 28);
    ctx.fill();

    const image = await loadImage(data.image);
    let textTop = 88;
    let textLeft = 82;
    let textWidth = 1036;
    if (image) {
      ctx.save();
      roundedRect(ctx, 70, 68, 430, 539, 22);
      ctx.clip();
      drawCover(ctx, image, 70, 68, 430, 539);
      ctx.restore();
      textLeft = 548;
      textWidth = 570;
      textTop = 90;
    }

    ctx.fillStyle = '#ffbf4a';
    ctx.font = '900 28px Arial, sans-serif';
    ctx.fillText(data.label || 'Infinity Phi', textLeft, textTop);

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 48px Arial, sans-serif';
    const titleLines = wrapLines(ctx, data.title, textWidth, image ? 4 : 3);
    let y = textTop + 64;
    titleLines.forEach((line) => { ctx.fillText(line, textLeft, y); y += 56; });

    ctx.fillStyle = '#e8f0f5';
    ctx.font = '500 27px Arial, sans-serif';
    const bodyLines = wrapLines(ctx, data.body, textWidth, image ? 8 : 7);
    y += 20;
    bodyLines.forEach((line) => { ctx.fillText(line, textLeft, y); y += 37; });

    ctx.fillStyle = '#ffbf4a';
    ctx.font = '800 23px Arial, sans-serif';
    ctx.fillText('Infinity Phi • Search → cards → connected research', textLeft, 590);

    return await new Promise((resolve) => canvas.toBlob(resolve, 'image/png', 0.95));
  }

  function rememberCard(event) {
    const button = event.target?.closest?.('.phi-share-card');
    const card = button?.closest?.('.phi-orange-card');
    if (!card) return;
    pending = { card, at: Date.now() };
  }

  document.addEventListener('pointerdown', rememberCard, true);
  document.addEventListener('click', rememberCard, true);

  if (typeof navigator.share === 'function' && !navigator.share.__infinityPhiExactCard) {
    const previous = navigator.share.bind(navigator);
    const wrapped = async (data = {}) => {
      const capture = pending && Date.now() - pending.at < 3500 ? pending.card : null;
      pending = null;
      if (!capture) return previous(data);

      const info = cardData(capture);
      const landingUrl = typeof data.url === 'string' && data.url ? data.url : cardUrl(info);
      const basePayload = { ...data, title: info.title, text: info.body, url: landingUrl };

      try {
        const blob = await renderCard(capture);
        if (blob && typeof File === 'function') {
          const file = new File([blob], 'infinity-phi-card.png', { type: 'image/png' });
          if (typeof navigator.canShare !== 'function' || navigator.canShare({ files: [file] })) {
            try {
              return await previous({ ...basePayload, files: [file] });
            } catch (error) {
              if (error?.name === 'AbortError') throw error;
              // Android/X can reject the structured file + URL payload even when
              // canShare() says files are supported. Retry as an image attachment
              // with the landing URL embedded in the post text before giving up on
              // the rendered orange-card image.
              try {
                const attachmentText = clean(`${info.body}\n\n${landingUrl}`, 1800);
                return await previous({ title: info.title, text: attachmentText, files: [file] });
              } catch (fileError) {
                if (fileError?.name === 'AbortError') throw fileError;
              }
            }
          }
        }
      } catch (error) {
        if (error?.name === 'AbortError') throw error;
      }

      return previous(basePayload);
    };
    wrapped.__infinityPhiExactCard = true;
    try { Object.defineProperty(navigator, 'share', { configurable: true, writable: true, value: wrapped }); }
    catch { try { navigator.share = wrapped; } catch {} }
  }
})();