(() => {
  'use strict';
  if (window.__infinityPhiResultsControlsV1) return;
  window.__infinityPhiResultsControlsV1 = true;

  const clean = v => String(v || '').replace(/\s+/g,' ').trim();
  const q = () => clean(new URLSearchParams(location.search).get('q') || document.querySelector('input[aria-label="Search Infinity Phi"]')?.value || '');
  const style = document.createElement('style');
  style.textContent = `
    #phiResultImages,#phiWebsiteIndex,#phiGenerateWebsite{min-height:36px;border-radius:999px;padding:8px 13px;font:900 12px/1 system-ui,sans-serif;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;justify-content:center}
    #phiResultImages{border:1px solid #c4b5fd;background:#fff;color:#5b21b6}
    #phiWebsiteIndex{border:1px solid #cbd5e1;background:#fff;color:#0f172a}
    #phiGenerateWebsite{border:1px solid #34d399;background:#10b981;color:#052e16}
    #phiInlineImages{margin:0 0 28px;border:1px solid #d8b4fe;border-radius:28px;background:#fff;padding:16px;box-shadow:0 16px 42px rgba(15,23,42,.10)}
    #phiInlineImages h2{margin:0;color:#111827;font:950 26px/1.1 system-ui,sans-serif}.phi-inline-image-head{display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap}.phi-inline-image-refine{display:flex;gap:8px;margin-top:12px}.phi-inline-image-refine input{min-width:0;flex:1;border:1px solid #c4b5fd;border-radius:14px;background:#fff;color:#111827;padding:11px 13px;font:700 14px system-ui,sans-serif}.phi-inline-image-refine button,.phi-inline-back{border:1px solid #c4b5fd;border-radius:14px;background:#fff;color:#5b21b6;padding:10px 12px;font-weight:900}.phi-inline-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin-top:14px}.phi-inline-pick{overflow:hidden;border:2px solid #e5e7eb;border-radius:16px;background:#fff}.phi-inline-pick[data-selected="1"]{border-color:#f97316}.phi-inline-pick img{width:100%;height:170px;object-fit:cover;display:block}.phi-inline-pick div{padding:8px}.phi-inline-pick b{display:block;color:#111827;font:800 12px/1.25 system-ui,sans-serif}.phi-inline-pick button{width:100%;margin-top:7px;border:0;border-radius:10px;background:#f97316;color:#fff;padding:8px;font-weight:900}.phi-inline-pick[data-selected="1"] button{background:#15803d}.phi-inline-status{margin-top:10px;color:#475569;font:700 13px/1.4 system-ui,sans-serif}
  `;
  document.head.appendChild(style);

  function hidePurple(){
    document.querySelectorAll('section').forEach(section => {
      const h = section.querySelector('h2');
      if (h && /purple cards/i.test(h.textContent || '')) section.style.display='none';
    });
  }

  async function json(url){ try { const r=await fetch(url,{cache:'no-store'}); return r.ok?await r.json():null; } catch { return null; } }
  async function images(term){
    const c=new URL('https://commons.wikimedia.org/w/api.php');
    c.search=new URLSearchParams({action:'query',generator:'search',gsrsearch:term,gsrnamespace:'6',gsrlimit:'36',prop:'imageinfo',iiprop:'url|extmetadata',iiurlwidth:'1000',format:'json',origin:'*'}).toString();
    const o=new URL('https://api.openverse.org/v1/images/'); o.search=new URLSearchParams({q:term,page_size:'36'}).toString();
    const [cj,oj]=await Promise.all([json(c),json(o)]);
    const a=Object.values(cj?.query?.pages||{}).map(x=>({image:x.imageinfo?.[0]?.thumburl||x.imageinfo?.[0]?.url,title:(x.title||'').replace(/^File:/,''),url:x.imageinfo?.[0]?.descriptionurl||'',provider:'Wikimedia Commons'}));
    const b=(oj?.results||[]).map(x=>({image:x.thumbnail||x.url,title:x.title||term,url:x.foreign_landing_url||x.url,provider:x.source||'Openverse'}));
    const seen=new Set(); return [...a,...b].filter(x=>x.image&&!seen.has(x.image)&&seen.add(x.image)).slice(0,60);
  }
  function saved(){try{return JSON.parse(localStorage.getItem('phiShared:imageSelections:v1')||'[]')}catch{return[]}}
  function save(item,term){let all=saved(),key=item.url||item.image,i=all.findIndex(x=>(x.sourceUrl||x.url||x.image)===key);if(i>=0)all.splice(i,1);else all.unshift({id:'infinity-image-'+Date.now(),storyKey:key,title:item.title,image:item.image,imageUrl:item.image,sourceUrl:item.url,url:item.url,provider:item.provider,searchQuery:q(),refinedQuery:term,selectedFromImageSearch:true,collectedAt:new Date().toISOString(),kind:'image-seed'});localStorage.setItem('phiShared:imageSelections:v1',JSON.stringify(all.slice(0,500)));return i<0}

  async function openImages(){
    const main=document.querySelector('main[aria-live="polite"]'); if(!main)return;
    const article=main.querySelector(':scope > article'); if(article)article.hidden=true;
    let page=document.getElementById('phiInlineImages'); if(page)page.remove();
    page=document.createElement('section');page.id='phiInlineImages';
    page.innerHTML=`<div class="phi-inline-image-head"><div><small>INFINITY PHI · IMAGES</small><h2>${q()}</h2></div><button class="phi-inline-back">Back to results</button></div><form class="phi-inline-image-refine"><input value="${q().replace(/"/g,'&quot;')}" aria-label="Refine image search"><button>Refine images</button></form><div class="phi-inline-status">Finding image and design choices…</div><div class="phi-inline-grid"></div>`;
    const first=main.querySelector(':scope > section'); first?.insertAdjacentElement('afterend',page);
    page.querySelector('.phi-inline-back').onclick=()=>{page.remove();if(article)article.hidden=false};
    const run=async term=>{const grid=page.querySelector('.phi-inline-grid'),status=page.querySelector('.phi-inline-status');grid.innerHTML='';status.textContent='Finding image and design choices…';const list=await images(term);status.textContent=list.length?`${list.length} choices ready. Collect the visuals and design elements you want for the website.`:'No image choices returned. Try broader wording.';const chosen=new Set(saved().map(x=>x.sourceUrl||x.url||x.image));list.forEach(item=>{const card=document.createElement('article');card.className='phi-inline-pick';card.dataset.selected=chosen.has(item.url||item.image)?'1':'0';card.innerHTML=`<img loading="lazy" alt=""><div><b></b><small></small><button type="button">${card.dataset.selected==='1'?'✓ Collected':'Collect'}</button></div>`;card.querySelector('img').src=item.image;card.querySelector('img').alt=item.title;card.querySelector('b').textContent=item.title;card.querySelector('small').textContent=item.provider;card.querySelector('button').onclick=()=>{const on=save(item,term);card.dataset.selected=on?'1':'0';card.querySelector('button').textContent=on?'✓ Collected':'Collect'};grid.appendChild(card)})};
    page.querySelector('form').onsubmit=e=>{e.preventDefault();run(clean(page.querySelector('input').value)||q())};
    run(q());
  }

  function install(){
    hidePurple();
    const input=document.querySelector('input[aria-label="Search Infinity Phi"]'); const section=input?.closest('section'); const bar=section?.querySelector('.mb-3'); if(!bar||!q())return;
    if(!document.getElementById('phiResultImages')){const b=document.createElement('button');b.id='phiResultImages';b.type='button';b.textContent='Images';b.onclick=openImages;bar.insertBefore(b,bar.querySelector('span.ml-auto')||null)}
    if(!document.getElementById('phiWebsiteIndex')){const a=document.createElement('a');a.id='phiWebsiteIndex';a.textContent='Website Index';a.href=`https://www-infinity4.github.io/Omni-Phi/cards/?q=${encodeURIComponent(q())}&mode=search&from=infinity`;bar.insertBefore(a,bar.querySelector('span.ml-auto')||null)}
    if(!document.getElementById('phiGenerateWebsite')){const a=document.createElement('a');a.id='phiGenerateWebsite';a.textContent='Generate website';a.href=`https://www-infinity4.github.io/Omni-Phi/autobuild/?q=${encodeURIComponent(q())}&mode=search&from=infinity&autobuild=1`;bar.insertBefore(a,bar.querySelector('span.ml-auto')||null)}
  }
  install(); const mo=new MutationObserver(install);mo.observe(document.documentElement,{childList:true,subtree:true});window.addEventListener('infinity-history-updated',install);
})();