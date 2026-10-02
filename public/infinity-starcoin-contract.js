(function(global){
  "use strict";
  const GUEST_KEY="starquest_guest_profile_v1";
  const SESSION_KEY="starquest_session";
  const USERS_KEY="starquest_users";
  const UNIFIED_KEY="infinity_unified_wallet_v1";
  const LABELS=["Star Coin wallet","Unified wallet","Open token workspace"];

  const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key)||"null")??fallback}catch{return fallback}};
  function snapshot(){
    const session=read(SESSION_KEY,null),users=read(USERS_KEY,{}),
      wallet=(session?.key&&users?.[session.key])||read(GUEST_KEY,{});
    const balance=Math.max(0,Number(wallet?.tokens)||0),
      progress=Math.max(0,Number(wallet?.pendingShareCredits)||0),
      shares=Math.max(0,Number(wallet?.shareCount)||0);
    return {balance,progress,shares,effective:Math.round((balance+progress/10)*10)/10};
  }
  function check(){
    const detail={
      ok:Boolean(global.InfinityTokenCount)&&Boolean(document.body),
      labels:LABELS,
      starCoin:snapshot(),
      storage:{guest:GUEST_KEY,session:SESSION_KEY,users:USERS_KEY,unified:UNIFIED_KEY},
      checkedAt:new Date().toISOString()
    };
    global.dispatchEvent(new CustomEvent("infinity:wallet-contract",{detail}));
    return detail;
  }
  global.InfinityStarCoinContract={snapshot,check,labels:LABELS};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",check,{once:true});
  else check();
})(window);
