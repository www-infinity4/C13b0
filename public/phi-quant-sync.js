(function(global){
'use strict';
if(global.PhiQuantCounterpart)return;
const KEY='phi:pendingQuantCounterparts:v1';
const read=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'[]')}catch{return[]}};
const save=items=>localStorage.setItem(KEY,JSON.stringify(items));let running=false;
async function flush(){if(running)return;running=true;try{for(const item of read()){
 try{let response;const url='https://quanta-phi-ledger.marvaseater.workers.dev/v1/quants/search',body={query:item.query,search_id:item.search_id};
  if(global.StarQuestCloudLedger?.authenticatedFetch)response=await global.StarQuestCloudLedger.authenticatedFetch(url,{method:'POST',body});
  else if(global.InfinityCloudWallet||typeof global.InfinityUnifiedWallet==='function'){const Wallet=global.InfinityCloudWallet||global.InfinityUnifiedWallet;const wallet=new Wallet({appName:item.source});response=await fetch(url,{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+wallet.token()},body:JSON.stringify(body)})}else break;
  const result=await response.json();if(!response.ok)throw new Error(result.error||'Quant counterpart failed');
  global.PhiAssetBalances?.confirm('QUANT',item.token_id);save(read().filter(x=>x.token_id!==item.token_id));global.dispatchEvent(new CustomEvent('phi:quant-counterpart-recorded',{detail:item}));
 }catch(error){console.warn('Phi Quant counterpart remains queued',error);break}
}}finally{running=false}}
async function enqueue(detail){if(!detail?.token_id||!detail.query)return;const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('phi-quant:'+detail.token_id));const search_id=Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,'0')).join('').slice(0,32);const items=read();if(!items.some(x=>x.token_id===detail.token_id)){items.push({...detail,search_id});save(items);global.PhiAssetBalances?.mint('QUANT',detail.token_id)}void flush()}
global.PhiQuantCounterpart={enqueue,flush,pending:read};global.addEventListener('phi:quant-counterpart',e=>void enqueue(e.detail));for(const event of ['load','online','focus'])global.addEventListener(event,flush);document.addEventListener('starquest:ledger-connected',flush);
})(window);
