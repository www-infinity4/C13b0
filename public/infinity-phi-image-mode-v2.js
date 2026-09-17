(() => {
  'use strict';
  if (!/\/phi(?:\/|$)/.test(location.pathname)) return;
  if (window.__infinityPhiImageModeV2) return;
  window.__infinityPhiImageModeV2 = true;

  function selectedCount(page) {
    return page ? page.querySelectorAll('.phi-image-pick[data-selected="1"]').length : 0;
  }

  function rewrite(page) {
    if (!page) return;
    const count = selectedCount(page);

    page.querySelectorAll('.phi-image-use').forEach((button) => {
      const card = button.closest('.phi-image-pick');
      button.textContent = card?.dataset.selected === '1' ? '✓ Collected' : 'Collect';
    });

    const explanation = page.querySelector('.phi-image-selection-overview');
    if (explanation) {
      explanation.textContent = count
        ? `${count} image${count === 1 ? '' : 's'} collected. These selections will become orange source cards on the Website Builder page so you can inspect the attached source information before deciding what belongs in the final site.`
        : 'Collect the images you want to inspect. They will become orange source cards on the Website Builder page; nothing is built from this page.';
    }

    const bottom = page.querySelector('.phi-image-builder');
    if (bottom) {
      bottom.textContent = count ? `Website Builder · ${count} selected →` : 'Collect images to open Website Builder';
      bottom.title = 'Open the Website Builder with the collected images as orange source cards';
    }

    let top = page.querySelector('#infinityPhiImageBuilderTop');
    if (!top) {
      top = document.createElement('button');
      top.id = 'infinityPhiImageBuilderTop';
      top.type = 'button';
      top.className = 'phi-image-builder';
      top.style.marginTop = '12px';
      top.addEventListener('click', () => page.querySelector('.phi-image-builder:not(#infinityPhiImageBuilderTop)')?.click());
      page.querySelector('.phi-image-mode-head > div')?.appendChild(top);
    }
    top.disabled = !count;
    top.textContent = count ? `Website Builder · ${count} selected →` : 'Collect images to open Website Builder';
    top.title = 'Open the Website Builder with the collected images as orange source cards';

    const intro = page.querySelector('.phi-image-mode-head p');
    if (intro) intro.textContent = 'Collect the images you want. Each collected image carries its source information into the Website Builder as an orange card. Review those cards there, let the purple cards describe the site structure, and use the green Build Website button only when you are ready to build.';
  }

  function attach(page) {
    if (!page || page.dataset.imageModeV2 === '1') return;
    page.dataset.imageModeV2 = '1';
    rewrite(page);

    page.addEventListener('click', (event) => {
      if (event.target?.closest?.('.phi-image-use')) setTimeout(() => rewrite(page), 0);
    });

    const grid = page.querySelector('.phi-image-mode-grid');
    if (grid) {
      const observer = new MutationObserver(() => {
        rewrite(page);
        if (grid.querySelector('.phi-image-pick')) observer.disconnect();
      });
      observer.observe(grid, { childList: true });
      setTimeout(() => observer.disconnect(), 12000);
    }
  }

  document.addEventListener('click', (event) => {
    if (!event.target?.closest?.('#infinityPhiImageModeButton')) return;
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      const page = document.getElementById('infinityPhiImageMode');
      if (page) attach(page);
      if (page || attempts >= 40) clearInterval(timer);
    }, 100);
  }, true);
})();