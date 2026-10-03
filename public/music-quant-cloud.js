(function(){
'use strict';
const ENDPOINT='https://quanta-phi-ledger.marvaseater.workers.dev';
const LOCAL='musicPhi:quants:v1',LISTENING='musicPhi:listeningQuants:v1',UNIFIED='infinity_unified_wallet_v1';
const read=(k,f)=>{try{return JSON.parse(localStorage.getItem(k))??f}catch{return f}},write=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));return true}catch{return false}};
let syncing=false;
function mirror(state){
 const unified=read(UNIFIED,{}),walletId=state.wallet_id||unified.currentWalletId||'music-quant-cloud';
 const wallets=unified.wallets&&typeof unified.wallets==='object'?unified.wallets:{},wallet=wallets[walletId]&&typeof wallets[walletId]==='object'?wallets[walletId]:{},balances=wallet.balances&&typeof wallet.balances==='object'?wallet.balances:{};
 wallets[walletId]={...wallet,balances:{...balances,MUSIC_QUANT:Number(state.balance||0)},updatedAt:Date.now()};
 write(UNIFIED,{...unified,currentWalletId:walletId,wallets,musicQuants:Number(state.balance||0),updatedAt:Date.now(),source:'music-quant-cloud'});
 window.dispatchEvent(new CustomEvent('controlphi:wallet-change',{detail:{musicQuants:Number(state.balance||0),source:'music-quant-cloud'}}));
 window.ControlPhi?.refreshWallet?.();
}
function mergeCloud(cloud){
 const playable=read(LOCAL,[]),listening=read(LISTENING,[]),playableMap=new Map(playable.filter(q=>!q.transferredAt).map(q=>[q.id,q])),listeningMap=new Map(listening.filter(q=>!q.transferredAt).map(q=>[q.id,q]));
 (Array.isArray(cloud)?cloud:[]).forEach(q=>{if(!q?.id)return;if(q.kind==='listening'&&Array.isArray(q.notes)&&q.notes.length===0)listeningMap.set(q.id,q);else if(Array.isArray(q.notes)&&q.notes.length>=5&&q.notes.length<=15)playableMap.set(q.id,q)});
 const playableMerged=[...playableMap.values()].sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||''))).slice(0,500);
 const listeningMerged=[...listeningMap.values()].sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||''))).slice(0,500);
 write(LOCAL,playableMerged);write(LISTENING,listeningMerged);return [...playableMerged,...listeningMerged];
}
async function sync(){
 if(syncing)return {ok:false,reason:'sync_in_progress'};const Wallet=window.InfinityCloudWallet;const bridge=window.StarQuestCloudLedger||(Wallet?{authenticatedFetch:(url,opt={})=>{const w=new Wallet({appName:document.title});return fetch(url,{...opt,headers:{'content-type':'application/json',authorization:'Bearer '+w.token(),...(opt.headers||{})},body:typeof opt.body==='string'?opt.body:opt.body?JSON.stringify(opt.body):undefined})}}:null);const indexed=window.MusicQuantStore?await window.MusicQuantStore.list().catch(()=>[]):[],playableMap=new Map([...read(LOCAL,[]),...indexed].filter(q=>q?.id&&!q.transferredAt).map(q=>[q.id,q])),listeningMap=new Map(read(LISTENING,[]).filter(q=>q?.id&&!q.transferredAt&&!playableMap.has(q.id)).map(q=>[q.id,q])),localBalance=playableMap.size+listeningMap.size;window.MusicQuantCloud.localCount=localBalance;window.MusicQuantCloud.pianoCount=playableMap.size;window.MusicQuantCloud.listeningCount=listeningMap.size;window.ControlPhi?.refreshWallet?.();if(!bridge?.authenticatedFetch){return {ok:false,reason:'account_not_connected',localBalance}}syncing=true;
 try{
  const local=[...playableMap.values(),...listeningMap.values()].sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||''))).slice(0,1000);
  if(local.length){
   for(let offset=0;offset<local.length;offset+=100){
    const response=await bridge.authenticatedFetch(ENDPOINT+'/v1/music-quants/sync',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({quants:local.slice(offset,offset+100)})});
    if(!response.ok)throw new Error('music_quant_sync_failed');
    const receipt=await response.json().catch(()=>({}));
    const submitted=local.slice(offset,offset+100).map(q=>q.id);
    const accepted=new Set(receipt.accepted||[]);
    if(submitted.some(id=>!accepted.has(id)))throw new Error('music_quant_rejected_by_ledger');
   }
  }
  const stateResponse=await bridge.authenticatedFetch(ENDPOINT+'/v1/music-quants/state',{cache:'no-store'});
  const state=await stateResponse.json().catch(()=>({}));
  if(!stateResponse.ok)throw new Error(state.error||'music_quant_state_failed');
  mergeCloud(state.quants);const owned=new Map((state.quants||[]).filter(q=>q?.id&&!q.transferredAt).map(q=>[q.id,q]));window.MusicQuantCloud.pianoCount=[...owned.values()].filter(q=>q.kind!=='listening').length;window.MusicQuantCloud.listeningCount=[...owned.values()].filter(q=>q.kind==='listening').length;window.MusicQuantCloud.state=state;window.MusicQuantCloud.lastError='';mirror(state);
  window.dispatchEvent(new CustomEvent('musicquant:cloud-synced',{detail:state}));
  return state;
 }catch(error){console.warn('Music Quant cloud sync deferred',error);window.MusicQuantCloud.lastError=String(error?.message||error);window.dispatchEvent(new CustomEvent('musicquant:cloud-error',{detail:{message:window.MusicQuantCloud.lastError}}));window.ControlPhi?.refreshWallet?.();return {ok:false,reason:window.MusicQuantCloud.lastError}}
 finally{syncing=false}
}
window.MusicQuantCloud={sync,endpoint:ENDPOINT,state:null,localCount:0};
document.addEventListener('starquest:ledger-connected',()=>void sync());
addEventListener('musicquant:changed',()=>void sync());
addEventListener('online',()=>void sync());
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{sync();setInterval(sync,30000)},{once:true});else{sync();setInterval(sync,30000)}
})();
