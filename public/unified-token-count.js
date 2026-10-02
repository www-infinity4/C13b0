(function(global){
'use strict';
const STATE_KEY='infinity_unified_token_count_v2';
const LEDGER_KEY='c13b0_infinity_token_ledger_v3';
const PHI_KEY='infinityPhi:searchTokens:v1';
const OMNI_KEY='omniPhi:history:v1';
const QUANTA_KEY='quantaPhiBuildHistoryV1';
const UNIFIED_KEY='infinity_unified_wallet_v1';
const SESSION_KEY='starquest_session';
const USERS_KEY='starquest_users';
const GUEST_KEY='starquest_guest_profile_v1';

const json=(key,fallback=null)=>{try{return JSON.parse(localStorage.getItem(key)||'null')??fallback}catch{return fallback}};
function decodeEnvelope(raw){
  if(!raw)return null;
  try{
    const parsed=JSON.parse(raw);
    if(parsed&&typeof parsed==='object'&&typeof parsed.data==='string'){
      const bin=atob(parsed.data),bytes=Uint8Array.from(bin,ch=>ch.charCodeAt(0));
      return JSON.parse(new TextDecoder().decode(bytes));
    }
    return parsed;
  }catch{return null}
}
function ledger(){
  try{const value=decodeEnvelope(localStorage.getItem(LEDGER_KEY));return Array.isArray(value)?value:[]}catch{return[]}
}
function hash(value){
  const s=String(value||'');let h=2166136261;
  for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}
  return (h>>>0).toString(36);
}
function addId(set,id,exclude){
  id=String(id||'').trim();
  if(!id||id===exclude)return;
  set.add(id);
}
function synthetic(prefix,item){
  return prefix+'-'+hash(JSON.stringify([item?.query||item?.title||'',item?.createdAt||item?.created_at||item?.at||'']));
}
function knownIds(exclude=''){
  const ids=new Set();
  for(const item of ledger()) addId(ids,item?.id||item?.tokenId,exclude);
  const phi=json(PHI_KEY,[]); if(Array.isArray(phi)) for(const item of phi) addId(ids,item?.id||synthetic('phi',item),exclude);
  const omni=json(OMNI_KEY,[]); if(Array.isArray(omni)) for(const item of omni) addId(ids,item?.tokenId||item?.id||synthetic('omni',item),exclude);
  const quanta=json(QUANTA_KEY,[]); if(Array.isArray(quanta)) for(const item of quanta) addId(ids,item?.token_id||item?.tokenId||item?.id||synthetic('quant',item),exclude);
  const unified=json(UNIFIED_KEY,{});
  const searches=Array.isArray(unified?.searches)?unified.searches:[];
  for(const item of searches) addId(ids,item?.tokenId||item?.id||synthetic('unified-search',item),exclude);
  if(unified?.tokens&&typeof unified.tokens==='object'){
    for(const [key,value] of Object.entries(unified.tokens)){
      const type=String(value?.token_type||value?.type||value?.kind||'').toLowerCase();
      const source=String(value?.sourceSystem||value?.source||'').toLowerCase();
      if(type.includes('search')||source.includes('quanta')||source.includes('omni')||source.includes('infinity')){
        addId(ids,value?.tokenId||value?.id||key,exclude);
      }
    }
  }
  const session=json(SESSION_KEY,null),users=json(USERS_KEY,{}),signed=session?.key&&users?.[session.key],guest=json(GUEST_KEY,{});
  for(const wallet of [signed,guest]){
    if(!wallet)continue;
    for(const item of Array.isArray(wallet.infinityLedger)?wallet.infinityLedger:[]) addId(ids,item?.tokenId||item?.id,exclude);
    for(const item of Array.isArray(wallet.infinitySearches)?wallet.infinitySearches:[]) addId(ids,item?.tokenId||item?.id||synthetic('wallet-search',item),exclude);
  }
  return ids;
}
function numericFloor(){
  const values=[ledger().length];
  const phi=json(PHI_KEY,[]),omni=json(OMNI_KEY,[]),quanta=json(QUANTA_KEY,[]);
  if(Array.isArray(phi))values.push(phi.length);
  if(Array.isArray(omni))values.push(omni.length);
  if(Array.isArray(quanta))values.push(quanta.length);
  const unified=json(UNIFIED_KEY,{});
  values.push(Number(unified?.infinityTokens)||0,Number(unified?.balance)||0);
  const wid=unified?.currentWalletId||unified?.walletId,active=wid&&unified?.wallets?.[wid];
  values.push(Number(active?.balances?.INFINITY)||0,Number(active?.balances?.infinityTokens)||0);
  const session=json(SESSION_KEY,null),users=json(USERS_KEY,{}),signed=session?.key&&users?.[session.key],guest=json(GUEST_KEY,{});
  values.push(Number(signed?.infinityTokens)||0,Number(guest?.infinityTokens)||0);
  return Math.max(0,...values.filter(Number.isFinite));
}
function readState(){
  const state=json(STATE_KEY,{});
  return{
    version:2,
    value:Math.max(0,Number(state?.value)||0),
    countedTokenIds:Array.isArray(state?.countedTokenIds)?state.countedTokenIds.map(String):[],
    updatedAt:String(state?.updatedAt||'')
  };
}
function writeState(state){
  const out={version:2,value:Math.max(0,Math.trunc(Number(state.value)||0)),countedTokenIds:[...new Set(state.countedTokenIds||[])].slice(-20000),updatedAt:new Date().toISOString()};
  try{localStorage.setItem(STATE_KEY,JSON.stringify(out))}catch{}
  global.dispatchEvent(new CustomEvent('infinity:token-count-updated',{detail:out}));
  return out;
}
function reconcile(extraFloor=0){
  const state=readState(),known=knownIds(),counted=new Set(state.countedTokenIds);
  known.forEach(id=>counted.add(id));
  const value=Math.max(state.value,known.size,numericFloor(),Math.max(0,Number(extraFloor)||0));
  return writeState({value,countedTokenIds:[...counted]});
}
function register(tokenId){
  tokenId=String(tokenId||'').trim();
  if(!tokenId)return reconcile();
  const state=readState();
  if(state.countedTokenIds.includes(tokenId))return reconcile();
  const known=knownIds(tokenId),counted=new Set(state.countedTokenIds);
  known.forEach(id=>counted.add(id));
  const base=Math.max(state.value,known.size,numericFloor());
  counted.add(tokenId);
  return writeState({value:base+1,countedTokenIds:[...counted]});
}
function value(){return reconcile().value}
global.InfinityTokenCount={KEY:STATE_KEY,reconcile,register,value,state:readState,knownIds:()=>[...knownIds()]};
try{reconcile()}catch{}
})(window);
