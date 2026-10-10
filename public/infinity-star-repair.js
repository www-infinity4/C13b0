(function(){
  "use strict";
  if(window.__infinityStarRepairV1)return;
  window.__infinityStarRepairV1=true;
  const GUEST="starquest_guest_profile_v1",SESSION="starquest_session",USERS="starquest_users",UNIFIED="infinity_unified_wallet_v1";
  const read=(k,f)=>{try{return JSON.parse(localStorage.getItem(k)||"null")??f}catch{return f}};
  const write=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));return true}catch{return false}};
  function store(){
    const s=read(SESSION,null),u=read(USERS,{});
    if(s?.key&&u?.[s.key])return{wallet:u[s.key],save(w){u[s.key]=w;write(USERS,u)}};
    const w=read(GUEST,{key:"__guest__",username:"Guest",tokens:0,pendingShareCredits:0,shareCount:0,shareEvents:[],ledger:[]});
    return{wallet:w,save(w){write(GUEST,w)}};
  }
  function normalize(w){
    w=w&&typeof w==="object"?w:{};
    w.tokens=Math.max(0,Number(w.tokens)||0);
    w.pendingShareCredits=Math.max(0,Number(w.pendingShareCredits)||0);
    w.shareCount=Math.max(0,Number(w.shareCount)||0);
    w.shareEvents=Array.isArray(w.shareEvents)?w.shareEvents:[];
    w.ledger=Array.isArray(w.ledger)?w.ledger:[];
    return w;
  }
  function mirror(w){
    try{
      const state=read(UNIFIED,null),id=state?.currentWalletId,active=id&&state?.wallets?.[id];
      if(active){
        active.balances=active.balances&&typeof active.balances==="object"?active.balances:{};
        active.balances.starCoin=w.tokens+w.pendingShareCredits/10;
        active.balances.starCoinWhole=w.tokens;
        active.balances.starCoinProgress=w.pendingShareCredits;
        active.starCoinShares=w.shareCount;
        state.updatedAt=new Date().toISOString();
        write(UNIFIED,state);
      }
    }catch{}
  }
  function snapshot(w){
    w=normalize(w||store().wallet);
    return{balance:w.tokens,progress:w.pendingShareCredits,effective:Math.round((w.tokens+w.pendingShareCredits/10)*10)/10,shares:w.shareCount};
  }
  function ensureCollect(storyKey){
    storyKey=String(storyKey||"").trim();if(!storyKey)return snapshot();
    // Control Phi is the sole payout path; never run the second local mint.
    if(window.ControlPhi?.ensureActionCredit)return window.ControlPhi.ensureActionCredit(storyKey,'collect');
    return {pending:true,reference:storyKey};
    const s=store(),w=normalize(s.wallet),now=Date.now(),recent=w.ledger.some(e=>e?.type==="collect_credit"&&(e?.referenceId===storyKey||e?.referenceId==="infinity-phi:"+storyKey)&&now-Number(e?.createdAt||0)<8000);
    if(recent)return snapshot(w);
    const ref="infinity-phi:"+storyKey;
    if(w.ledger.some(e=>e?.type==="collect_credit"&&e?.referenceId===ref))return snapshot(w);
    w.pendingShareCredits+=1;
    let awarded=0;
    while(w.pendingShareCredits>=10){w.pendingShareCredits-=10;w.tokens+=1;awarded+=1}
    w.ledger.push({id:"tx-infinity-repair-"+now.toString(36),type:"collect_credit",amount:awarded,credit:0.1,balance:w.tokens,pendingShareCredits:w.pendingShareCredits,referenceId:ref,createdAt:now,source:"infinity-phi"});
    w.ledger=w.ledger.slice(-2000);s.save(w);mirror(w);
    const detail={...snapshot(w),awarded,credit:0.1,action:"collect",source:"infinity-phi"};
    window.dispatchEvent(new Event("infinity-wallet-updated"));
    window.dispatchEvent(new CustomEvent("starquest:share-progress",{detail}));
    window.dispatchEvent(new CustomEvent("controlphi:wallet-change",{detail}));
    return detail;
  }
  window.addEventListener("controlphi:shared",e=>{
    const d=e?.detail||{};
    if(String(d.source||"").toLowerCase()!=="infinity-phi")return;
    setTimeout(()=>ensureCollect(d.storyKey),50);
  });
  window.InfinityStarRepair={snapshot:()=>snapshot(),ensureCollect};
})(window);