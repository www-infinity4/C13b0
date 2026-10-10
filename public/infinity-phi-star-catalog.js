/* Infinity Phi -> the authenticated QuantaPhi StarCoin action catalog.
   Records evidence against the same StarQuest wallet token. Never mints on page load. */
(function(root){
 'use strict';
 if(root.InfinityStarCatalog)return;
 const API='https://quanta-phi-ledger.marvaseater.workers.dev/v1/quants/star-coins';
 const KEY='infinityPhi:pendingStarCoinCatalog:v1';
 const ALLOWED=new Set(['collect','share','star','build_image','fix_image','extract','compare']);
 const pendingMemory=new Map();
 let syncing=false;
 const parse=()=>{try{const v=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(v)?v:[]}catch{return []}};
 function pending(){
  return [...new Map([...parse(),...pendingMemory.values()].filter(x=>x?.reference_id).map(x=>[x.reference_id,x])).values()];
 }
 function save(items){
  try{localStorage.setItem(KEY,JSON.stringify(items.slice(-1000)));pendingMemory.clear();return true}
  catch{return false}
 }
 async function identifier(kind,reference){
  const raw=kind+'|'+reference;
  if(root.crypto?.subtle && typeof TextEncoder!=='undefined'){
   const digest=await root.crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw));
   return Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('');
  }
  // Non-cryptographic fallback is only a stable retry identifier, never authentication.
  let a=2166136261,b=0x9e3779b9;
  for(let i=0;i<raw.length;i++){a=Math.imul(a^raw.charCodeAt(i),16777619);b=Math.imul(b^raw.charCodeAt(i),2246822519)}
  return (a>>>0).toString(16).padStart(8,'0')+(b>>>0).toString(16).padStart(8,'0');
 }
 function evidence(card,kind,reference){
  const source=card&&typeof card==='object'?card:{};
  const record={
   id:String(source.id||source.storyKey||reference).slice(0,500),
   title:String(source.title||source.sourceTitle||'Infinity Phi research').slice(0,400),
   query:String(source.searchQuery||source.query||'').slice(0,800),
   tokenId:String(source.tokenId||source.searchTokenId||'').slice(0,300),
   story:String(source.story||source.extract||source.body||'').slice(0,9000),
   sourceUrl:String(source.sourceUrl||source.url||'').slice(0,2000),
   media:String(source.image||source.imageUrl||'').slice(0,2000),
   domain:String(source.domain||source.provider||'').slice(0,200),
   reference,kind,site:'infinity-phi',
   recordedAt:new Date().toISOString()
  };
  return record;
 }
 async function record(kind,reference,card){
  if(!ALLOWED.has(kind))return {queued:false,error:'unsupported_action'};
  const ref=String(reference||'').trim();
  if(!ref)return {queued:false,error:'missing_reference'};
  const hash=await identifier(kind,ref);
  const reference_id='quantaphi:'+kind+':infinity:'+hash;
  const data=evidence(card,kind,ref);
  const receipt={kind,reference_id,reference:ref.slice(0,700),created_at:new Date().toISOString(),data,
   card:kind==='collect'?{key:data.id,type:'omni-source',title:data.title,story:data.story,media:data.media,sourceUrl:data.sourceUrl}:undefined};
  const items=pending();
  if(!items.some(x=>x.reference_id===reference_id)){
   items.push(receipt);
   if(!save(items))pendingMemory.set(reference_id,receipt);
  }
  void flush();
  return {queued:true,reference_id};
 }
 async function flush(){
  if(syncing)return {pending:pending().length};
  const Wallet=root.InfinityCloudWallet||root.InfinityUnifiedWallet;
  if(!Wallet)return {pending:pending().length,connected:false};
  let token;
  try{token=new Wallet({appName:'Infinity Phi StarCoin Catalog'}).token()}catch{return {pending:pending().length,connected:false}}
  if(!/^sq_[A-Za-z0-9_-]{32,}$/.test(token))return {pending:pending().length,connected:false};
  syncing=true;
  try{
   for(let page=0;page<10;page++){
    const items=pending().slice(0,100);if(!items.length)break;
    const response=await fetch(API,{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+token},body:JSON.stringify({credits:items}),signal:AbortSignal.timeout(12000)});
    if(!response.ok)break;
    const result=await response.json().catch(()=>({}));
    const accepted=new Set(Array.isArray(result.accepted)?result.accepted:[]);
    if(!accepted.size)break;
    const rest=pending().filter(x=>!accepted.has(x.reference_id));
    if(!save(rest))for(const key of accepted)pendingMemory.delete(key);
   }
  }catch(error){console.warn('Infinity StarCoin catalog sync deferred',error)}
  finally{syncing=false}
  return {pending:pending().length,connected:true};
 }
 root.InfinityStarCatalog={record,flush,pending:()=>pending().length};
 for(const event of ['load','online','focus'])root.addEventListener(event,()=>{void flush()});
 root.document?.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')void flush()});
 root.addEventListener('infinity:wallet-state',()=>{void flush()});
 setTimeout(()=>{void flush()},0);
})(window);
