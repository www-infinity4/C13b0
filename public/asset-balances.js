(function(global){
'use strict';
if(global.PhiAssetBalances)return;
const KEY='phi:assetBalances:v1',read=(k,f)=>{try{return JSON.parse(localStorage.getItem(k)||'null')??f}catch{return f}};
const state=read(KEY,{assets:{}});state.assets=state.assets||{};
const number=x=>Math.max(0,Number(x)||0);
function asset(code){if(!state.assets[code]){const w=read('infinity_unified_wallet_v1',{}),active=w.wallets?.[w.currentWalletId];state.assets[code]={balance:code==='QUANT'?number(localStorage.getItem('quantaPhiTokens')):number(active?.balances?.[code]),pending:{},epoch:0,cloud:false}}return state.assets[code]}
function persist(){try{localStorage.setItem(KEY,JSON.stringify(state))}catch{}global.dispatchEvent(new CustomEvent('phi:asset-balances',{detail:snapshot()}))}
function value(code){const a=asset(code);return number(a.balance)+Object.keys(a.pending||{}).length}
function snapshot(){return Object.fromEntries(['INFINITY','QUANT','MUSIC_QUANT'].map(code=>[code,{balance:value(code),pending:Object.keys(asset(code).pending||{}).length,cloud:asset(code).cloud}]))}
function mint(code,id){const a=asset(code);a.pending=a.pending||{};if(!a.pending[id]){a.pending[id]=true;a.epoch++;persist()}return value(code)}
function confirm(code,id,balance){const a=asset(code),wasPending=Boolean(a.pending?.[id]);if(wasPending){delete a.pending[id];a.balance=Object.keys(a.pending).length===0&&Number.isFinite(Number(balance))?number(balance):number(a.balance)+1;a.epoch++;a.cloud=true;persist()}else if(Number.isFinite(Number(balance)))accept(code,balance,a.epoch);return value(code)}
function beginRead(code){return asset(code).epoch}
function accept(code,balance,epoch){const a=asset(code);if(epoch!==a.epoch||Object.keys(a.pending||{}).length||!Number.isFinite(Number(balance)))return false;a.balance=number(balance);a.cloud=true;persist();return true}
function seed(code,balance){const a=asset(code);if(!a.cloud&&number(balance)>a.balance){a.balance=number(balance);persist()}return value(code)}
global.PhiAssetBalances={KEY,value,snapshot,mint,confirm,beginRead,accept,seed};
global.addEventListener('storage',e=>{if(e.key===KEY){const next=read(KEY,null);if(next?.assets){state.assets=next.assets;global.dispatchEvent(new CustomEvent('phi:asset-balances',{detail:snapshot()}))}}});
})(window);
