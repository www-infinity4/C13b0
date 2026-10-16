const origin='https://quantaphi.org';
const routes=['/infinity-phi/bubbles-research/','/infinity-phi/studio/build/'];
const results=[];
for(const route of routes){
 const response=await fetch(origin+route+'?asset_check='+Date.now(),{headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(15000)});
 const html=await response.text();if(!response.ok)throw Error('Live route HTTP '+response.status+' '+route);
 const assets=[...new Set([...html.matchAll(/(?:src|href)=["']([^"']*[/]_next[/]static[/][^"']+[.](?:js|css)(?:[?][^"']*)?)["']/g)].map(m=>new URL(m[1],origin).href))];
 if(!assets.length)throw Error('No Next.js assets in live route '+route);
 for(let at=0;at<assets.length;at+=6){const batch=await Promise.all(assets.slice(at,at+6).map(async url=>{const r=await fetch(url,{headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(15000)});const type=r.headers.get('content-type')||'';await r.body?.cancel();return {path:new URL(url).pathname,status:r.status,type};}));results.push(...batch);}
}
console.log(JSON.stringify({routes,assets:results},null,2));
if(results.some(r=>r.status!==200||/text[/]html/i.test(r.type)))throw Error('A published research route references unavailable JavaScript or CSS');
