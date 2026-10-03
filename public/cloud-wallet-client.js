(function(global){
'use strict';
const ENDPOINT='https://unified-wallet.marvaseater.workers.dev';
const DEVICE_PREFIX='starquest_ledger_device_v1:';
const read=(key,fallback=null)=>{try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}};
function storedToken(key){const raw=localStorage.getItem(key)||'';if(/^sq_[A-Za-z0-9_-]{32,}$/.test(raw))return raw;const value=read(key,null);return /^sq_[A-Za-z0-9_-]{32,}$/.test(value?.deviceToken||'')?value.deviceToken:''}
function findDeviceToken(){const session=read('starquest_session',null),username=String(session?.username||session?.key||'').toLowerCase(),exact=username&&storedToken(DEVICE_PREFIX+username);if(exact)return exact;for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i)||'';if(!key.startsWith(DEVICE_PREFIX))continue;const token=storedToken(key);if(token)return token}return ''}
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
