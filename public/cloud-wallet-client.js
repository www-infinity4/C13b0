(function(global){
'use strict';
const ENDPOINT='https://unified-wallet.marvaseater.workers.dev';
const DEVICE_PREFIX='starquest_ledger_device_v1:';
const PAID_ORIGINS=new Set(['https://quantaphi.org','https://www.quantaphi.org','https://quantaphi.net','https://www.quantaphi.net']);
const read=(key,fallback=null)=>{try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}};
function storedToken(key){const raw=localStorage.getItem(key)||'';if(/^sq_[A-Za-z0-9_-]{32,}$/.test(raw))return raw;const value=read(key,null);return /^sq_[A-Za-z0-9_-]{32,}$/.test(value?.deviceToken||'')?value.deviceToken:''}
function deviceCandidates(){
 const out=[],seen=new Set();
 try{for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i)||'';if(!key.startsWith(DEVICE_PREFIX))continue;const token=storedToken(key);if(token&&!seen.has(token)){seen.add(token);out.push({key,username:key.slice(DEVICE_PREFIX.length).toLowerCase(),token})}}}catch{}
 return out;
}
function findDeviceToken(){
 try{
  const session=read('starquest_session',null),username=String(session?.username||session?.key||'').toLowerCase();
  if(username){const exact=storedToken(DEVICE_PREFIX+username);if(exact)return exact}
  const candidates=deviceCandidates();
  return candidates.length===1?candidates[0].token:'';
 }catch{return ''}
}
async function resolveDeviceToken(){
 const exact=findDeviceToken();if(exact)return exact;
 const candidates=deviceCandidates();if(!candidates.length)return '';
 const session=read('starquest_session',null),users=read('starquest_users',{}),backup=read('starquest_users_backup_v1',{});
 const known=new Set([session?.key,session?.username,...Object.keys(users||{}),...Object.keys(backup||{})].map(v=>String(v||'').trim().toLowerCase()).filter(Boolean));
 let matched=null,only=null,valid=0;
 for(const candidate of candidates){
  try{
   const response=await fetch('https://starquest-ledger.marvaseater.workers.dev/v1/state',{headers:{authorization:'Bearer '+candidate.token},cache:'no-store',signal:AbortSignal.timeout(5000)});
   const payload=await response.json().catch(()=>({}));if(!response.ok||!payload?.ok||!payload?.state)continue;
   valid++;const username=String(payload.state.username||candidate.username||'').trim().toLowerCase(),entry={candidate,username};
   only=entry;
   if(username&&known.has(username)){matched=entry;break}
  }catch(_){}
 }
 const chosen=matched||(valid===1?only:null);
 if(!chosen)return '';
 if(chosen.username&&storedToken(DEVICE_PREFIX+chosen.username)!==chosen.candidate.token)try{localStorage.setItem(DEVICE_PREFIX+chosen.username,chosen.candidate.token)}catch(_){}
 return chosen.candidate.token;
}
function hasAccountProfile(){
 const session=read('starquest_session',null),key=String(session?.key||'').toLowerCase();
 return Boolean(key&&read('starquest_users',{})?.[key]);
}
async function recoverAccountProfileFromDevice(){
 const token=await resolveDeviceToken();if(!token||hasAccountProfile())return hasAccountProfile();
 try{
  const response=await fetch('https://starquest-ledger.marvaseater.workers.dev/v1/state',{headers:{authorization:'Bearer '+token},cache:'no-store',signal:AbortSignal.timeout(8000)});
  const payload=await response.json().catch(()=>({}));
  if(!response.ok||!payload?.ok||!payload?.state)return false;
  const state=payload.state,username=String(state.username||'').trim().toLowerCase();
  if(!username||storedToken(DEVICE_PREFIX+username)!==token)return false;
  const users=read('starquest_users',{});if(!users||Array.isArray(users)||typeof users!=='object')return false;
  if(!users[username]){
   users[username]={
    key:username,username:String(state.username||username),passwordHash:'',joinedAt:Date.now(),lastLoginAt:Date.now(),
    tokens:Math.max(0,Number(state.starCoins)||0),pendingShareCredits:Math.max(0,Number(state.pendingShareCredits)||0),
    shareCount:Math.max(0,Number(state.shareCount)||0),shareEvents:[],ledger:Array.isArray(state.ledger)?state.ledger:[],
    watchHistory:Array.isArray(state.watchHistory)?state.watchHistory:[],watchPositions:{},unlockedContent:{}
   };
   localStorage.setItem('starquest_users',JSON.stringify(users));
  }
  const session=read('starquest_session',null);
  if(!session||String(session.key||session.username||'').toLowerCase()!==username){
   localStorage.setItem('starquest_session',JSON.stringify({key:username,username:users[username].username||username,signedInAt:Date.now()}));
  }
  const user=global.StarQuestAuth?.currentUser?.();
  if(user)document.dispatchEvent(new CustomEvent('starquest:auth-changed',{detail:{user,action:'device-profile-recovery'}}));
  return Boolean(user||hasAccountProfile());
 }catch(error){console.warn('Cloud wallet profile recovery deferred',error);return false}
}
function importAccountProfile(values){
 const session=JSON.parse(values.starquest_session||'null'),key=String(session?.key||session?.username||'').toLowerCase();
 const incoming=JSON.parse(values.starquest_users||'{}')?.[key];
 if(!key||!incoming||String(incoming.key||'').toLowerCase()!==key)return;
 const users=read('starquest_users',{});if(!users||Array.isArray(users)||typeof users!=='object')throw new Error('invalid_account_cache');
 if(!users[key])localStorage.setItem('starquest_users',JSON.stringify({...users,[key]:incoming}));
}
function importTopLevelHandoff(){
 let encoded='';try{encoded=new URLSearchParams(location.hash.slice(1)).get('quantaWalletLink')||''}catch{}
 if(!encoded)return false;
 try{
  const base64=encoded.replace(/-/g,'+').replace(/_/g,'/'),binary=atob(base64),bytes=Uint8Array.from(binary,char=>char.charCodeAt(0));
  const payload=JSON.parse(new TextDecoder().decode(bytes));
  if(payload?.version!==1||!['https://www-infinity4.github.io','https://quantaphi.org','https://www.quantaphi.org','https://quantaphi.net','https://www.quantaphi.net'].includes(payload.source)||Math.abs(Date.now()-Number(payload.issuedAt||0))>300000)throw new Error('expired_wallet_handoff');
  const values=payload.values&&typeof payload.values==='object'?payload.values:{};
  const current=read('starquest_session',null),remote=JSON.parse(values.starquest_session||'null');
  if(current&&(current.key||current.username)!==(remote?.key||remote?.username))throw new Error('account_mismatch');
  importAccountProfile(values);
  for(const [key,value]of Object.entries(values)){
   if((key==='starquest_session'||/^starquest_ledger_device_v1:[A-Za-z0-9_-]+$/.test(key))&&typeof value==='string'&&localStorage.getItem(key)===null)localStorage.setItem(key,value);
  }
  return Boolean(findDeviceToken());
 }catch(error){console.warn('Wallet handoff rejected',error);return false}
 finally{try{const clean=new URL(location.href);clean.hash='';history.replaceState(history.state,'',clean.href)}catch{}}
}
const handoffImported=PAID_ORIGINS.has(location.origin)&&importTopLevelHandoff();
const connectionStatus={bridge:PAID_ORIGINS.has(location.origin)?(handoffImported?'linked':'pending'):'not-required'};
const ready=PAID_ORIGINS.has(location.origin)?new Promise(resolve=>{
 const start=()=>{
  const frame=document.createElement('iframe'),nonce=crypto.randomUUID();frame.hidden=true;frame.src='https://www-infinity4.github.io/QuantaPhi/wallet-link.html?v=20261004-account9';
  let done=false;const finish=(status='timeout')=>{if(done)return;done=true;connectionStatus.bridge=status;clearTimeout(timer);global.removeEventListener('message',receive);frame.remove();resolve()};
  const timer=setTimeout(()=>finish('timeout'),8000);
  const receive=event=>{
   if(event.origin!=='https://www-infinity4.github.io'||event.source!==frame.contentWindow||event.data?.type!=='quanta:link-response'||event.data.nonce!==nonce)return;
   try{const current=read('starquest_session',null),remote=JSON.parse(event.data.values?.starquest_session||'null');if(current&&(current.key||current.username)!==(remote?.key||remote?.username)){finish('account-mismatch');return}}catch(_){finish('account-mismatch');return}
   try{importAccountProfile(event.data.values||{})}catch(error){finish('account-cache-error');return}
   const allowed=new Set(['starquest_session','c13b0_infinity_token_ledger_v3','infinity_unified_token_count_v3','phi:assetBalances:v1','quantaPhiBuildHistoryV1','quantaPhiCollected','quantaPhiTokens','quantaPhi:pendingSearchCommits:v2','quantaPhi:pendingInfinityCredits:v1']);
   try{for(const [key,value]of Object.entries(event.data.values||{})){if((allowed.has(key)||/^starquest_ledger_device_v1:[A-Za-z0-9_-]+$/.test(key))&&typeof value==='string'&&localStorage.getItem(key)===null)localStorage.setItem(key,value)}}catch(_){}
   global.dispatchEvent(new StorageEvent('storage',{key:'phi:assetBalances:v1'}));finish('linked');
   const user=global.StarQuestAuth?.currentUser?.();
   if(user)document.dispatchEvent(new CustomEvent('starquest:auth-changed',{detail:{user,action:'wallet-recovery'}}));
   document.dispatchEvent(new CustomEvent('starquest:ledger-connected'));
  };
  global.addEventListener('message',receive);frame.onerror=()=>finish('unavailable');frame.onload=()=>frame.contentWindow.postMessage({type:'quanta:link-request',nonce},'https://www-infinity4.github.io');document.body.appendChild(frame);
 };
 if(document.body)start();else document.addEventListener('DOMContentLoaded',start,{once:true});
}):Promise.resolve();
global.QuantaCloudConnection={ready,status:connectionStatus,hasCredential:()=>Boolean(findDeviceToken()),hasAccountProfile,recoverAccountProfileFromDevice,resolveDeviceToken,async authenticatedFetch(target,options={}){
 if(!findDeviceToken())await ready;
 if(!findDeviceToken())await recoverAccountProfileFromDevice();
 const url=new URL(target);
 const allowed=(url.origin===ENDPOINT&&['/v1/wallet/state','/v1/tokens/mint'].includes(url.pathname))||(url.origin==='https://quanta-phi-ledger.marvaseater.workers.dev'&&(url.pathname.startsWith('/v1/quants/')||url.pathname.startsWith('/v1/music-quants/')));
 if(!allowed)throw new Error('unsupported_wallet_target');
 const bridge=global.StarQuestCloudLedger;
 if(bridge?.authenticatedFetch){try{return await bridge.authenticatedFetch(target,options)}catch(error){if(error.message!=='ledger_not_connected')throw error}}
 const token=findDeviceToken()||await resolveDeviceToken();if(!token)throw new Error('ledger_not_connected');
 const body=options.body&&typeof options.body==='object'?JSON.stringify(options.body):options.body;
 return fetch(target,{...options,body,headers:{...(options.headers||{}),'content-type':'application/json',authorization:'Bearer '+token}});
}};
function recoverWallet(){
 if(!PAID_ORIGINS.has(location.origin)||(findDeviceToken()&&hasAccountProfile()))return false;
 try{
  if(sessionStorage.getItem('quantaPhi:firstPartyWalletHandoff:v4'))return false;
  sessionStorage.setItem('quantaPhi:firstPartyWalletHandoff:v4',String(Date.now()));
  const returnUrl=new URL(location.href);returnUrl.hash='';
  const bridge=new URL('https://quantaphi.org/__wallet-handoff');
  bridge.searchParams.set('v','20261004-account9');bridge.searchParams.set('return',returnUrl.href);
  location.replace(bridge.href);
  return true;
 }catch(error){console.warn('First-party wallet handoff unavailable',error)}
 return false;
}
global.QuantaCloudConnection.recoverWallet=recoverWallet;
ready.then(async()=>{
 // A valid enrolled token can reconstruct its own local profile from D1. Do
 // that before any recovery navigation so cache loss cannot create identity drift.
 if(!PAID_ORIGINS.has(location.origin))return;
 if(findDeviceToken()&&!hasAccountProfile())await recoverAccountProfileFromDevice();
 if(findDeviceToken())return;
 const query=new URL(location.href).searchParams.get('q')||document.getElementById?.('q')?.value||'';
 if(String(query).trim()||document.activeElement?.matches?.('input,textarea'))return;
 recoverWallet();
});
if(PAID_ORIGINS.has(location.origin))document.addEventListener('click',event=>{
 if(event.target.closest?.('#controlPhiWalletButton,#qmenuWallet'))recoverWallet();
},true);
class InfinityUnifiedWallet{
 constructor(options={}){this.endpoint=options.endpoint||ENDPOINT;this.appName=options.appName||document.title||location.hostname;this.state=null;this.listeners=new Set()}
 token(){const token=findDeviceToken();if(!/^sq_[A-Za-z0-9_-]{32,}$/.test(token))throw new Error('Connect the same StarQuest account before using the unified wallet.');return token}
 async request(path,options={}){const response=await fetch(this.endpoint+path,{signal:AbortSignal.timeout(8000),...options,headers:{'content-type':'application/json','authorization':'Bearer '+this.token(),...(options.headers||{})}});const result=await response.json().catch(()=>({}));if(!response.ok)throw new Error(result.error||'unified_wallet_request_failed');return result}
 async connect(){return this.refresh()}
 async refresh(){this.state=await this.request('/v1/wallet/state',{cache:'no-store'});this.listeners.forEach(fn=>fn(this.state));global.dispatchEvent(new CustomEvent('infinity:wallet-state',{detail:this.state}));return this.state}
 async importLegacy({importKey='browser-v1',balances={},tokens=[]}={}){const result=await this.request('/v1/wallet/import',{method:'POST',body:JSON.stringify({importKey,source:this.appName,balances,tokens})});await this.refresh();return result}
 async mintToken(type,data,idempotencyKey){const result=await this.request('/v1/tokens/mint',{method:'POST',body:JSON.stringify({type,data,idempotencyKey,source:this.appName})});await this.refresh();return result}
 async spendInfinity(amount,referenceId,idempotencyKey,metadata={}){const result=await this.request('/v1/wallet/spend',{method:'POST',body:JSON.stringify({asset:'INFINITY',amount,referenceId,idempotencyKey,metadata})});await this.refresh();return result}
 subscribe(listener){this.listeners.add(listener);if(this.state)listener(this.state);return()=>this.listeners.delete(listener)}
}
global.InfinityCloudWallet=InfinityUnifiedWallet;
})(window);
