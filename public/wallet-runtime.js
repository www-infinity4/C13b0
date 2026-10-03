(function controlPhiBootstrap(){
  'use strict';
  if(window.ControlPhi?.version)return;

  const ROOT='https://www-infinity4.github.io/';
  const scriptElement=document.currentScript;
  const scriptSource=scriptElement?.src||`${ROOT}Control-Phi/control-phi.js`;
  const WALLET_ONLY=scriptElement?.dataset?.controlPhiWalletOnly==='true';
  const ASSET_ROOT=`${ROOT}Control-Phi/`;
  const NEWS_URL=`${ROOT}News-Phi/`;
  const SHARE_KEY='controlPhi:shareFeed:v1';
  const INTEREST_KEY='phiShared:interestSignals:v1';
  const CONTEXT_KEY='phiContext:events:v1';
  const CONTEXT_RETENTION_MS=7*24*60*60*1000;
  const WALLET_GUEST_KEY='starquest_guest_profile_v1';
  const WALLET_SESSION_KEY='starquest_session';
  const WALLET_USERS_KEY='starquest_users';
  const SHOP_CART_KEY='infinity_phi_shop_cart_v1';
  const MAX_SHARES=500;
  const DEDUPE_WINDOW_MS=1500;

  const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}};
  const write=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));return true}catch{return false}};
  const clean=(value,max=1200)=>String(value||'').replace(/\s+/g,' ').trim().slice(0,max);
  const slug=(value)=>clean(value,180).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'interest';
  const pageMeta=(name)=>document.querySelector(`meta[property="${name}"],meta[name="${name}"]`)?.content||'';
  const nowPlaying=()=>clean(document.querySelector('[data-now-playing], #nowTitle, #programTitle, #np-channel, .now-title')?.textContent||'',180);
  const pageChannel=()=>clean(document.body?.dataset?.channel||pageMeta('application-name')||pageMeta('og:site_name')||document.title.split(/[—|]/)[0]||document.querySelector('h1')?.textContent,100);

  function searchTerms(payload){
    const raw=[payload.title,payload.text,payload.channel,nowPlaying(),pageMeta('description')].filter(Boolean).join(' ');
    const words=clean(raw,600).replace(/https?:\/\/\S+/g,' ').replace(/[^\p{L}\p{N}' -]+/gu,' ').split(/\s+/).filter(word=>word.length>2);
    return [...new Set(words)].slice(0,18).join(' ');
  }

  function describe(payload,query){
    const title=clean(payload.title||document.title||'Shared from Infinity TV',180);
    const channel=clean(payload.channel||pageChannel(),100);
    const detail=clean(payload.text||nowPlaying()||pageMeta('description'),1000);
    const lead=`${title} was shared${channel?` from ${channel}`:''}.`;
    const context=detail&&detail.toLowerCase()!==title.toLowerCase()?detail:`The share points to ${clean(payload.url||location.href,300)} and preserves the program or subject as a News Phi research starting point.`;
    const next=`News Phi prepared the research query “${query}” from the information available at the moment of sharing. The outward share keeps the original channel URL and preview while News Phi records the share as an interest signal in the background.`;
    return [lead,context,next].join(' ');
  }

  const signatureOf=(payload)=>[payload.url,payload.title,payload.channel].map(value=>clean(value,300).toLowerCase()).join('|');
  const platformFromHref=(href='')=>{
    if(/(?:twitter\.com|x\.com)\//i.test(href))return 'x';
    if(/facebook\.com\//i.test(href))return 'facebook';
    if(/linkedin\.com\//i.test(href))return 'linkedin';
    if(/reddit\.com\//i.test(href))return 'reddit';
    if(/^mailto:/i.test(href))return 'email';
    return 'share';
  };

  function normalizePayload(input={}){
    return {
      title:clean(input.title||document.title,180),
      text:clean(input.text||nowPlaying()||pageMeta('description'),900),
      url:clean(input.url||location.href,900),
      image:clean(input.image||pageMeta('og:image')||pageMeta('twitter:image'),700),
      channel:clean(input.channel||pageChannel(),100)
    };
  }

  function buildTrackingUrl(payload,id,platform='share'){
    const target=clean(payload.url||location.href,900);
    if(!target)return NEWS_URL;
    try{
      const existing=new URL(target,location.href);
      if(existing.origin===new URL(NEWS_URL).origin&&existing.pathname.includes('/News-Phi/')&&existing.searchParams.get('phiTrack')==='1')return existing.href;
    }catch{}
    const query=searchTerms(payload)||payload.title;
    const params=new URLSearchParams({
      phiTrack:'1',
      shareId:id,
      target,
      title:payload.title,
      channel:payload.channel,
      query:clean(query,420),
      platform:clean(platform,40)
    });
    return `${NEWS_URL}?${params.toString()}`;
  }

  function recordActivity(action,topic='',extra={}){
    const safeAction=clean(action,40).toLowerCase();
    const safeTopic=clean(topic,180);
    if(!safeAction||!safeTopic||/\b(health|medical|religion|politic|election|sexual|race|ethnic|disability|addiction|password|login|bank|credit)\b/i.test(safeTopic))return null;
    const now=Date.now();
    const event={id:`ctx-${now.toString(36)}-${Math.random().toString(36).slice(2,8)}`,action:safeAction,topic:safeTopic,channel:pageChannel(),program:nowPlaying(),page:location.pathname,at:new Date(now).toISOString(),source:'control-phi',...extra};
    const events=read(CONTEXT_KEY,[]).filter(item=>now-Date.parse(item?.at||0)<CONTEXT_RETENTION_MS);
    const newest=events[0];
    if(newest&&newest.action===event.action&&newest.topic===event.topic&&now-Date.parse(newest.at||0)<1500)return newest;
    events.unshift(event);write(CONTEXT_KEY,events.slice(0,100));
    window.dispatchEvent(new CustomEvent('controlphi:activity',{detail:event}));return event;
  }

  function installContextBridge(){
    if(document.documentElement.dataset.controlPhiContext==='1')return;
    document.documentElement.dataset.controlPhiContext='1';
    document.addEventListener('submit',event=>{
      const form=event.target;if(!(form instanceof HTMLFormElement))return;
      const input=form.querySelector('input[type="search"],input[name="q"],input[name="query"]');
      const value=clean(input?.value,180);if(value)recordActivity('search',value);
    },true);
  }

  function recordInterest(kind,payload,extra={}){
    const program=clean(nowPlaying()||payload.title||payload.channel,180);
    const channel=clean(payload.channel||pageChannel(),100);
    const topicKey=`program:${slug(channel||'infinity')}:${slug(program||payload.title)}`;
    const signal={
      id:`interest-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`,
      kind,
      topicKey,
      program,
      channel,
      query:clean(extra.query||searchTerms(payload)||payload.title,420),
      url:payload.url,
      image:payload.image,
      hits:1,
      collectedAt:new Date().toISOString(),
      source:'control-phi',
      ...extra
    };
    const signals=read(INTEREST_KEY,[]);
    signals.unshift(signal);
    write(INTEREST_KEY,signals.slice(0,1200));
    window.dispatchEvent(new CustomEvent('newsphi:interest',{detail:signal}));
    return signal;
  }

  function walletStore(){
    const session=read(WALLET_SESSION_KEY,null);
    const users=read(WALLET_USERS_KEY,{});
    if(session&&session.key&&users&&users[session.key]){
      return {profile:users[session.key],save(profile){users[session.key]=profile;write(WALLET_USERS_KEY,users)}};
    }
    const guest=read(WALLET_GUEST_KEY,{key:'__guest__',username:'Guest',tokens:0,shareCount:0,pendingShareCredits:0,shareEvents:[],ledger:[],watchHistory:[],watchPositions:{},unlockedContent:{}});
    return {profile:guest,save(profile){write(WALLET_GUEST_KEY,profile)}};
  }

  function normalizeWallet(profile){
    const wallet=profile&&typeof profile==='object'?profile:{};
    wallet.tokens=Math.max(0,Number(wallet.tokens)||0);
    wallet.shareCount=Math.max(0,Number(wallet.shareCount)||0);
    wallet.pendingShareCredits=Math.max(0,Number(wallet.pendingShareCredits)||0);
    wallet.shareEvents=Array.isArray(wallet.shareEvents)?wallet.shareEvents:[];
    wallet.ledger=Array.isArray(wallet.ledger)?wallet.ledger:[];
    wallet.watchHistory=Array.isArray(wallet.watchHistory)?wallet.watchHistory:[];
    wallet.watchPositions=wallet.watchPositions&&typeof wallet.watchPositions==='object'?wallet.watchPositions:{};
    wallet.unlockedContent=wallet.unlockedContent&&typeof wallet.unlockedContent==='object'?wallet.unlockedContent:{};
    return wallet;
  }

  function decodeInfinityEnvelope(raw){
    if(!raw)return null;
    try{
      const parsed=JSON.parse(raw);
      if(parsed&&typeof parsed==='object'&&typeof parsed.data==='string'){
        const binary=atob(parsed.data),bytes=Uint8Array.from(binary,ch=>ch.charCodeAt(0));
        return JSON.parse(new TextDecoder().decode(bytes));
      }
      return parsed;
    }catch{return null}
  }

  function canonicalSearchCounts(){
    const records=new Map();
    const fp=value=>{const text=JSON.stringify(value||{});let h=2166136261;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619)}return(h>>>0).toString(36)};
    const put=(id,source,query='')=>{
      id=clean(id,500);if(!id)return;
      const current=records.get(id)||{id,source:'legacy',query:''};
      const nextSource=String(source||'').toLowerCase();
      const rank=value=>value==='quanta'?4:value==='omni'?3:value==='infinity'?2:1;
      if(rank(nextSource)>rank(current.source))current.source=nextSource;
      if(query&&!current.query)current.query=clean(query,500);
      records.set(id,current);
    };
    const classify=(item,id='')=>{
      const source=String(item?.sourceSystem||item?.source||'').toLowerCase();
      const kind=String(item?.kind||item?.token_type||item?.type||'').toLowerCase();
      const key=String(id||item?.id||item?.tokenId||'').toLowerCase();
      if(source.includes('quanta')||kind==='quant'||key.startsWith('quant-'))return'quanta';
      if(source.includes('omni')||kind.includes('omni')||key.startsWith('omni-'))return'omni';
      if(source.includes('infinity')||kind==='research'||key.startsWith('phi-'))return'infinity';
      return'legacy';
    };
    try{
      const ledger=decodeInfinityEnvelope(localStorage.getItem('c13b0_infinity_token_ledger_v3'));
      if(Array.isArray(ledger))ledger.forEach(item=>{const id=item?.id||item?.tokenId;put(id,classify(item,id),item?.query)});
    }catch{}
    try{
      const phi=JSON.parse(localStorage.getItem('infinityPhi:searchTokens:v1')||'[]');
      if(Array.isArray(phi))phi.forEach(item=>put(item?.id,'infinity',item?.query));
    }catch{}
    try{
      const omni=JSON.parse(localStorage.getItem('omniPhi:history:v1')||'[]');
      if(Array.isArray(omni))omni.forEach(item=>{const query=String(item?.query||'').trim(),createdAt=String(item?.createdAt||''),id=item?.tokenId||item?.id||('omni-history-'+fp(['omni',query,createdAt]));if(query)put(id,'omni',query)});
    }catch{}
    try{
      const pending=JSON.parse(localStorage.getItem('omniPhi:pendingInfinitySearches:v1')||'[]');
      if(Array.isArray(pending))pending.forEach(item=>{const id=item?.tokenId||item?.id;if(item?.query&&id)put(id,'omni',item.query)});
      const last=JSON.parse(localStorage.getItem('omniPhi:lastSearchToken:v1')||'null');
      if(last?.query&&(last?.tokenId||last?.id))put(last.tokenId||last.id,'omni',last.query);
    }catch{}
    try{
      const quanta=JSON.parse(localStorage.getItem('quantaPhiBuildHistoryV1')||'[]');
      if(Array.isArray(quanta))quanta.forEach(item=>{const query=String(item?.query||'').trim(),createdAt=String(item?.created_at||item?.createdAt||''),id=item?.token_id||item?.tokenId||item?.id||('quant-history-'+fp(['quanta',query,createdAt]));if(query)put(id,'quanta',query)});
    }catch{}
    try{
      const state=read('infinity_unified_wallet_v1',null);
      const searches=Array.isArray(state?.searches)?state.searches:[];
      searches.forEach(item=>{const id=item?.tokenId||item?.id;put(id,classify(item,id),item?.query)});
      Object.entries(state?.tokens||{}).forEach(([key,item])=>{const id=item?.tokenId||item?.id||key;put(id,classify(item,id),item?.query)});
    }catch{}
    try{
      const session=read(WALLET_SESSION_KEY,null),users=read(WALLET_USERS_KEY,{}),profiles=[];
      if(session?.key&&users?.[session.key])profiles.push(users[session.key]);
      profiles.push(read(WALLET_GUEST_KEY,{}));
      profiles.forEach(profile=>{
        (Array.isArray(profile?.infinitySearches)?profile.infinitySearches:[]).forEach(item=>{const id=item?.tokenId||item?.id;put(id,classify(item,id),item?.query)});
        (Array.isArray(profile?.infinityLedger)?profile.infinityLedger:[]).forEach(item=>{const id=item?.tokenId||item?.id;put(id,classify(item,id),item?.query)});
      });
    }catch{}
    let infinity=0,omni=0,quants=0,legacy=0;
    records.forEach(item=>{if(item.source==='quanta')quants++;else if(item.source==='omni')omni++;else if(item.source==='infinity')infinity++;else legacy++});
    let total=records.size;
    try{
      const stable=read('infinity_unified_token_count_v3',null);
      total=Math.max(total,Number(stable?.value)||0);
    }catch{}
    return{total,infinity,omni,quants,legacy:legacy+Math.max(0,total-records.size)};
  }

  let cloudBalances={};
  async function refreshCloudBalances(){try{const bridge=window.StarQuestCloudLedger;if(!bridge?.authenticatedFetch){const Wallet=window.InfinityCloudWallet||(typeof window.InfinityUnifiedWallet==='function'?window.InfinityUnifiedWallet:null);if(Wallet){const wallet=new Wallet({appName:document.title});const state=await wallet.refresh();cloudBalances=state.balances||{};refreshWalletUI()}return}const r=await bridge.authenticatedFetch('https://unified-wallet.marvaseater.workers.dev/v1/wallet/state');if(!r.ok)return;const state=await r.json();cloudBalances=state.balances||{};refreshWalletUI()}catch(error){console.warn('Cloud wallet balance refresh deferred',error)}}
  window.addEventListener('infinity:wallet-state',e=>{cloudBalances=e.detail?.balances||{};refreshWalletUI()});
  document.addEventListener('starquest:ledger-connected',refreshCloudBalances);
  window.addEventListener('load',refreshCloudBalances);
  window.addEventListener('focus',refreshCloudBalances);
  function auxiliaryBalances(){
    let quants=0,infinity=0,musicQuants=0;
    const canonical=canonicalSearchCounts();
    try{
      const state=read('infinity_unified_wallet_v1',null);
      const id=state?.currentWalletId;
      const w=id&&state?.wallets?.[id];
      if(w?.balances){
        quants=Math.max(0,Number(w.balances.QUANT)||0);
        infinity=Math.max(0,Number(w.balances.INFINITY)||0);
        musicQuants=Math.max(0,Number(w.balances.MUSIC_QUANT)||0);
      }
      musicQuants=Math.max(musicQuants,Math.max(0,Number(state?.musicQuants)||0));
    }catch{}
    try{quants=Math.max(quants,Math.max(0,Number(localStorage.getItem('quantaPhiTokens'))||0))}catch{}
    try{const playable=(JSON.parse(localStorage.getItem('musicPhi:quants:v1')||'[]')||[]).length,listening=(JSON.parse(localStorage.getItem('musicPhi:listeningQuants:v1')||'[]')||[]).length;musicQuants=Math.max(musicQuants,playable+listening)}catch{}
    return {
      quants:canonical.quants,
      infinity:canonical.infinity,
      omni:canonical.omni,
      legacy:canonical.legacy,
      total:canonical.total,
      musicQuants:Math.max(musicQuants,Number(cloudBalances.MUSIC_QUANT)||0)
    };
  }

  function alienCoinCount(){
    try{
      const cached=Number(sessionStorage.getItem('controlPhi:alienCoinCount:v1'));
      return Number.isFinite(cached)&&cached>=0?cached:0;
    }catch{return 0}
  }

  async function refreshAlienCoinCount(){
    let session='';try{session=localStorage.getItem('alien-coin-wallet-session-v1')||''}catch{}
    if(!session){try{sessionStorage.setItem('controlPhi:alienCoinCount:v1','0')}catch{};refreshWalletUI();return 0}
    try{
      const response=await fetch('https://alien-coin.marvaseater.workers.dev/api/tokens',{headers:{Authorization:'Bearer '+session},cache:'no-store'});
      const data=await response.json();
      const count=response.ok&&Array.isArray(data.tokens)?data.tokens.length:0;
      try{sessionStorage.setItem('controlPhi:alienCoinCount:v1',String(count))}catch{}
      refreshWalletUI();return count;
    }catch{return alienCoinCount()}
  }

  function walletSnapshot(){
    const store=walletStore();
    const wallet=normalizeWallet(store.profile);
    const assets=auxiliaryBalances();
    return {balance:wallet.tokens,starCoins:wallet.tokens,progressToNextCoin:wallet.pendingShareCredits,shareCount:wallet.shareCount,username:wallet.username||'Guest',totalTokens:assets.total,quants:assets.quants,omni:assets.omni,infinity:assets.infinity,legacy:assets.legacy,musicQuants:assets.musicQuants,alienCoins:alienCoinCount()};
  }

  function importLegacyStarCoinBalance(amount,source='legacy'){
    const legacy=Math.round(Math.max(0,Number(amount)||0)*10)/10;
    const store=walletStore();
    const wallet=normalizeWallet(store.profile);
    const current=Math.round((wallet.tokens+(wallet.pendingShareCredits/10))*10)/10;
    if(!(legacy>current+0.0001)){
      refreshWalletUI();
      return {...walletSnapshot(),restored:false,legacy,current};
    }
    const whole=Math.floor(legacy+1e-9);
    const tenths=Math.max(0,Math.min(9,Math.round((legacy-whole)*10)));
    wallet.tokens=whole;
    wallet.pendingShareCredits=tenths;
    wallet.shareCount=Math.max(wallet.shareCount,whole*10+tenths);
    const referenceId='legacy-starcoin:'+clean(source,120);
    wallet.ledger.push({
      id:'tx-legacy-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8),
      type:'legacy_balance_recovery',
      amount:Math.round((legacy-current)*10)/10,
      balance:wallet.tokens,
      pendingShareCredits:wallet.pendingShareCredits,
      reason:'Recovered legacy StarCoin balance',
      referenceId,
      createdAt:Date.now(),
      source:'control-phi-recovery'
    });
    wallet.ledger=wallet.ledger.slice(-500);
    store.save(wallet);
    const detail={balance:wallet.tokens,progressToNextCoin:wallet.pendingShareCredits,restored:true,legacy,previous:current,source};
    window.dispatchEvent(new CustomEvent('controlphi:wallet-change',{detail}));
    refreshWalletUI();
    return {...walletSnapshot(),...detail};
  }

  function refreshWalletUI(){
    const snapshot=walletSnapshot();
    document.querySelectorAll('[data-control-phi-wallet-balance]').forEach(el=>{const value=String(snapshot.balance);if(el.textContent!==value)el.textContent=value});
    document.querySelectorAll('[data-control-phi-wallet-progress]').forEach(el=>{const value=`${snapshot.progressToNextCoin}/10`;if(el.textContent!==value)el.textContent=value});
    document.querySelectorAll('[data-control-phi-wallet-menu-balance]').forEach(el=>{const value=`${snapshot.balance} ⭐`;if(el.textContent!==value)el.textContent=value});
    document.querySelectorAll('[data-control-phi-wallet-menu-progress]').forEach(el=>{const value=`${snapshot.progressToNextCoin}/10`;if(el.textContent!==value)el.textContent=value});
    document.querySelectorAll('[data-control-phi-wallet-total]').forEach(el=>{const value=String(snapshot.totalTokens);if(el.textContent!==value)el.textContent=value});
        document.querySelectorAll('[data-control-phi-wallet-quants]').forEach(el=>{const value=String(snapshot.quants);if(el.textContent!==value)el.textContent=value});
    document.querySelectorAll('[data-control-phi-wallet-omni]').forEach(el=>{const value=String(snapshot.omni);if(el.textContent!==value)el.textContent=value});
    document.querySelectorAll('[data-control-phi-wallet-legacy]').forEach(el=>{const value=String(snapshot.legacy);if(el.textContent!==value)el.textContent=value});
    document.querySelectorAll('[data-control-phi-wallet-infinity]').forEach(el=>{const value=String(snapshot.infinity);if(el.textContent!==value)el.textContent=value});
    document.querySelectorAll('[data-control-phi-wallet-music-quants]').forEach(el=>{const value=String(snapshot.musicQuants);if(el.textContent!==value)el.textContent=value});
    document.querySelectorAll('[data-control-phi-wallet-alien-coins]').forEach(el=>{const value=String(snapshot.alienCoins);if(el.textContent!==value)el.textContent=value});
    const button=document.getElementById('controlPhiWalletButton');
    if(button)button.innerHTML=`<span class="cp-wallet-button-label">Wallet</span><span aria-hidden="true">⭐</span><strong>${snapshot.balance}</strong><small>${snapshot.progressToNextCoin}/10</small>`;
    const name=document.querySelector('[data-control-phi-wallet-name]');
    if(name)name.textContent=snapshot.username;
    return snapshot;
  }

  function recentConfirmedShare(wallet,now,reference=''){
    const ref=clean(reference||location.href,700);
    const ownReceipt=wallet.shareEvents.some(event=>{
      const when=Number(event?.createdAt||0);
      return when&&Math.abs(now-when)<3500&&event?.confirmed!==false&&event?.verified!==false&&event?.source==='control-phi-fallback'&&clean(event?.contentId,700)===ref;
    });
    if(ownReceipt)return true;
    return wallet.ledger.some(entry=>{
      const when=Number(entry?.createdAt||entry?.at||0);
      return when&&Math.abs(now-when)<3500&&(entry?.type==='share_credit'||entry?.type==='share_reward');
    });
  }

  function ensureActionCredit(reference='',kind='collect'){
    const store=walletStore();
    const wallet=normalizeWallet(store.profile);
    const ref=clean(reference||location.href,700);
    const eventKey=`action:${clean(kind,40)}:${ref}`;
    const already=wallet.ledger.some(entry=>entry?.referenceId===eventKey);
    if(already){refreshWalletUI();return {...walletSnapshot(),awarded:0,alreadyRecorded:true}}
    const now=Date.now();
    wallet.pendingShareCredits+=1;
    let awarded=0;
    while(wallet.pendingShareCredits>=10){wallet.pendingShareCredits-=10;wallet.tokens+=1;awarded+=1}
    wallet.ledger.push({id:`tx-action-${now.toString(36)}-${Math.random().toString(36).slice(2,8)}`,type:`${clean(kind,40)}_credit`,amount:awarded,balance:wallet.tokens,pendingShareCredits:wallet.pendingShareCredits,reason:`${kind} reward credit`,referenceId:eventKey,createdAt:now,source:'control-phi'});
    wallet.ledger=wallet.ledger.slice(-500);
    store.save(wallet);
    const detail={progressToNextCoin:wallet.pendingShareCredits,awarded,balance:wallet.tokens,source:'control-phi',kind};
    window.dispatchEvent(new CustomEvent('controlphi:wallet-change',{detail}));
    refreshWalletUI();
    return detail;
  }

  function ensureShareCredit(reference='',method='web_share_api'){
    const store=walletStore();
    const wallet=normalizeWallet(store.profile);
    const now=Date.now();
    if(recentConfirmedShare(wallet,now,reference)){
      refreshWalletUI();
      return {...walletSnapshot(),awarded:0,alreadyRecorded:true};
    }
    const attemptId=`controlphi-share-${now.toString(36)}-${Math.random().toString(36).slice(2,8)}`;
    wallet.shareCount+=1;
    wallet.pendingShareCredits+=1;
    wallet.shareEvents.push({id:attemptId,attemptId,contentId:clean(reference||location.href,700),method,confirmed:true,verified:true,createdAt:now,source:'control-phi-fallback'});
    let awarded=0;
    while(wallet.pendingShareCredits>=10){wallet.pendingShareCredits-=10;wallet.tokens+=1;awarded+=1}
    wallet.ledger.push({id:`tx-${attemptId}`,type:awarded?'share_reward':'share_credit',amount:awarded,balance:wallet.tokens,pendingShareCredits:wallet.pendingShareCredits,reason:awarded?'Share reward: 10 completed shares':`Confirmed share receipt ${wallet.pendingShareCredits}/10`,referenceId:attemptId,createdAt:now,source:'control-phi-fallback'});
    wallet.shareEvents=wallet.shareEvents.slice(-250);
    wallet.ledger=wallet.ledger.slice(-500);
    store.save(wallet);
    const detail={progressToNextCoin:wallet.pendingShareCredits,awarded,balance:wallet.tokens,shareCount:wallet.shareCount,source:'control-phi-fallback'};
    window.dispatchEvent(new CustomEvent('starquest:share-progress',{detail}));
    window.dispatchEvent(new CustomEvent('controlphi:wallet-change',{detail}));
    refreshWalletUI();
    return detail;
  }

  function shopCart(){const items=read(SHOP_CART_KEY,[]);return Array.isArray(items)?items:[]}

  function reconcileCollectedAds(){const items=shopCart();let credited=0;items.forEach(item=>{const ref=clean(item?.id||item?.url||item?.title,700);if(!ref)return;const result=ensureActionCredit(ref,'collect');if(!result?.alreadyRecorded)credited+=1});return {items:items.length,credited,...walletSnapshot()}}

  function injectWalletIntoMenu(){
    const nav=document.querySelector('details.channel-menu nav,details[data-channel-menu] nav,.qmenu,#controlPhiPanel .control-phi-links');
    if(!nav)return;
    let item=document.getElementById('controlPhiWalletMenuButton');
    if(!item){
      item=document.createElement('button');
      item.id='controlPhiWalletMenuButton';
      item.type='button';
      item.setAttribute('aria-label','Open StarCoin wallet');
      item.innerHTML='<span aria-hidden="true">⭐</span><span class="cp-wallet-menu-name"><strong>Unified Wallet</strong><small>StarCoin · Quants · Music Quants · Infinity · Alien Coin</small></span><span class="cp-wallet-menu-value"><strong data-control-phi-wallet-menu-balance>0 ⭐</strong><small><span data-control-phi-wallet-quants>0</span> Q · <span data-control-phi-wallet-music-quants>0</span> MQ · <span data-control-phi-wallet-infinity>0</span> Infinity · <span data-control-phi-wallet-alien-coins>0</span> Alien</small></span>';
      item.addEventListener('click',()=>document.getElementById('controlPhiWalletButton')?.click());
    }
    if(item.parentElement!==nav)nav.prepend(item);
    let cart=document.getElementById('controlPhiShopCartMenuButton');if(!cart){cart=document.createElement('button');cart.id='controlPhiShopCartMenuButton';cart.type='button';cart.innerHTML='<span aria-hidden="true">🛒</span><span class="cp-wallet-menu-name"><strong>Shopping Cart</strong><small>Collected advertisements</small></span><span class="cp-wallet-menu-value"><strong data-control-phi-cart-count>0</strong><small>saved ads</small></span>';cart.addEventListener('click',()=>location.assign('https://www-infinity4.github.io/Shop-Phi/?view=cart'))}if(cart.parentElement!==nav)item.insertAdjacentElement('afterend',cart);document.querySelectorAll('[data-control-phi-cart-count]').forEach(el=>el.textContent=String(shopCart().length));
    refreshWalletUI();
  }

  function watchWalletMenu(){
    if(window.__controlPhiWalletMenuObserver||!document.body)return;
    const observer=new MutationObserver(()=>{if(!document.getElementById('controlPhiWalletMenuButton'))injectWalletIntoMenu()});
    observer.observe(document.body,{childList:true,subtree:true});
    window.__controlPhiWalletMenuObserver=observer;
  }

  function injectWallet(){
    const prebuilt=document.getElementById('controlPhiWalletButton');
    const prebuiltPanel=document.getElementById('controlPhiWalletPanel');
    if(prebuilt&&prebuiltPanel){
      prebuilt.onclick=event=>{event.stopPropagation();prebuiltPanel.hidden=!prebuiltPanel.hidden;prebuilt.setAttribute('aria-expanded',String(!prebuiltPanel.hidden));if(!prebuiltPanel.hidden)refreshWalletUI()};
      prebuilt.dataset.controlPhiWalletBound='1';
      injectWalletIntoMenu();watchWalletMenu();refreshWalletUI();return
    }
    const existingTrigger=prebuilt||document.querySelector('[data-control-phi-wallet-trigger]');
    const style=document.createElement('style');
    style.id='controlPhiWalletStyle';
    style.textContent='#controlPhiWalletButton{display:inline-flex;align-items:center;gap:6px;min-height:40px;padding:7px 10px;border:1px solid rgba(255,255,255,.18);border-radius:12px;background:#141923;color:#fff;font:800 13px/1 system-ui,sans-serif;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.22)}#controlPhiWalletButton small{opacity:.72;font-size:10px}#controlPhiWalletButton.control-phi-wallet-floating{position:fixed;right:68px;bottom:16px;z-index:10001;background:#0b1020}#controlPhiWalletPanel{position:fixed;right:16px;bottom:68px;z-index:10002;width:min(330px,calc(100vw - 32px));padding:14px;border:1px solid rgba(255,255,255,.18);border-radius:16px;background:#080b12;color:#fff;box-shadow:0 24px 70px rgba(0,0,0,.58);font:500 14px/1.45 system-ui,sans-serif}#controlPhiWalletPanel[hidden]{display:none}#controlPhiWalletPanel .cp-wallet-row{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:7px 0}#controlPhiWalletPanel .cp-wallet-assets{display:grid;grid-template-columns:repeat(2,1fr);gap:7px;margin:10px 0}#controlPhiWalletPanel .cp-wallet-asset{border:1px solid rgba(255,255,255,.13);border-radius:11px;padding:9px 6px;text-align:center;background:#111827}#controlPhiWalletPanel .cp-wallet-asset span,#controlPhiWalletPanel .cp-wallet-asset small{display:block;font-size:10px;color:#cbd5e1}#controlPhiWalletPanel .cp-wallet-asset strong{display:block;font-size:18px;margin:3px 0}#controlPhiWalletPanel strong{font-size:18px}#controlPhiWalletPanel p{margin:10px 0 0;color:#cbd5e1;font-size:12px}#controlPhiWalletMenuButton{width:100%;min-height:50px;display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:9px;padding:9px 11px;margin:2px 0 5px;border:1px solid rgba(255,221,89,.34);border-radius:12px;background:linear-gradient(135deg,rgba(122,83,12,.38),rgba(18,15,9,.92));color:#fff;text-align:left;cursor:pointer;font:800 12px/1.2 system-ui,sans-serif}#controlPhiWalletMenuButton>span:first-child{font-size:18px}.cp-wallet-menu-name,.cp-wallet-menu-value{display:grid;gap:2px}.cp-wallet-menu-name small,.cp-wallet-menu-value small{font-size:10px;color:#d8c985}.cp-wallet-menu-value{justify-items:end}';
    document.head.appendChild(style);
    const button=existingTrigger||document.createElement('button');
    button.id='controlPhiWalletButton';button.type='button';button.setAttribute('aria-label','Open unified wallet');button.setAttribute('aria-expanded','false');
    const panel=document.createElement('section');panel.id='controlPhiWalletPanel';panel.hidden=true;panel.setAttribute('aria-label','Unified wallet');panel.innerHTML='<div class="cp-wallet-row"><span data-control-phi-wallet-name>Guest</span><strong>Unified Wallet</strong></div><div class="cp-wallet-assets"><div class="cp-wallet-asset"><span>Star Coins</span><strong><span data-control-phi-wallet-balance>0</span> ⭐</strong><small data-control-phi-wallet-progress>0/10</small></div><div class="cp-wallet-asset"><span>Total search tokens</span><strong data-control-phi-wallet-total>0</strong><small>Infinity + Omni + Quants</small></div><div class="cp-wallet-asset"><span>Infinity Phi</span><strong data-control-phi-wallet-infinity>0</strong><small>tokens</small></div><div class="cp-wallet-asset"><span>Omni Phi</span><strong data-control-phi-wallet-omni>0</strong><small>tokens</small></div><div class="cp-wallet-asset"><span>Quants</span><strong data-control-phi-wallet-quants>0</strong><small>tokens</small></div><div class="cp-wallet-asset"><span>Legacy / metadata pending</span><strong data-control-phi-wallet-legacy>0</strong><small>counted, details not recovered yet</small></div><div class="cp-wallet-asset"><span>Music Quants</span><strong data-control-phi-wallet-music-quants>0</strong><small>MQ · playable</small></div><div class="cp-wallet-asset"><span>Alien Coins</span><strong data-control-phi-wallet-alien-coins>0</strong><small>secured tokens</small></div></div><p>Search-token totals use the same merged Infinity + Omni + Quanta history as Token Workspace. Star Coins remain a separate share reward balance.</p>';
    const host=document.querySelector('.head-actions,.qbalances,[data-control-phi-wallet-host]');
    if(!existingTrigger){if(host)host.appendChild(button);else{button.classList.add('control-phi-wallet-floating');document.body.appendChild(button)}}
    document.body.appendChild(panel);
    const toggle=()=>{panel.hidden=!panel.hidden;button.setAttribute('aria-expanded',String(!panel.hidden));if(!panel.hidden)refreshWalletUI()};
    button.onclick=event=>{event.stopPropagation();toggle()};button.dataset.controlPhiWalletBound='1';
    document.addEventListener('click',event=>{if(panel.hidden||event.target===button||button.contains(event.target)||panel.contains(event.target)||event.target?.closest?.('#controlPhiWalletMenuButton'))return;panel.hidden=true;button.setAttribute('aria-expanded','false')});
    injectWalletIntoMenu();
    watchWalletMenu();
    refreshWalletUI();
    refreshAlienCoinCount();
    void refreshCloudBalances();
  }

  function recordShare(input={}){
    const now=new Date();
    const payload=normalizePayload(input);
    const query=clean(input.searchQuery||searchTerms(payload)||payload.title,500);
    const signature=signatureOf(payload);
    const feed=read(SHARE_KEY,[]);
    const newest=feed[0];
    if(newest&&newest.shareSignature===signature&&Date.now()-Date.parse(newest.collectedAt||0)<DEDUPE_WINDOW_MS)return newest;
    const id=clean(input.id,120)||`share-${now.getTime().toString(36)}-${Math.random().toString(36).slice(2,9)}`;
    const trackingUrl=clean(input.trackingUrl||buildTrackingUrl(payload,id,input.platform||input.shareMethod||'share'),1800);
    const event={id,storyKey:id,title:payload.title||'Shared story',extract:describe(payload,query),url:payload.url,image:payload.image,domain:payload.channel||location.hostname,channel:payload.channel,searchQuery:query,collectedAt:now.toISOString(),kind:'shared-news',shareConfirmed:input.shareConfirmed!==false,shareMethod:clean(input.shareMethod||'web_share_api',60),platform:clean(input.platform||'',40),trackingUrl,shareSignature:signature,source:'control-phi'};
    feed.unshift(event);
    write(SHARE_KEY,feed.slice(0,MAX_SHARES));
    recordInterest('share',payload,{query,shareId:id,platform:event.platform,trackingUrl});
    recordActivity('share',query,{shareId:id});
    window.dispatchEvent(new CustomEvent('controlphi:shared',{detail:event}));
    return event;
  }

  function sharePlan(data={},platform='share'){
    const payload=normalizePayload(data);
    const id=`share-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,9)}`;
    return {id,payload,platform,trackingUrl:buildTrackingUrl(payload,id,platform)};
  }

  function installShareBridge(){
    if(typeof navigator.share!=='function'||navigator.share.__controlPhi)return;
    const nativeShare=navigator.share.bind(navigator);
    const wrapped=async(data={})=>{
      const plan=sharePlan(data,'web_share_api');
      const outgoing={...data,title:data.title||plan.payload.title,text:data.text||plan.payload.text,url:plan.payload.url};
      const result=await nativeShare(outgoing);
      recordShare({...plan.payload,id:plan.id,trackingUrl:plan.trackingUrl,shareConfirmed:true,shareMethod:'web_share_api',platform:'external'});
      setTimeout(()=>ensureShareCredit(plan.payload.url,'web_share_api'),900);
      return result;
    };
    wrapped.__controlPhi=true;
    try{Object.defineProperty(navigator,'share',{configurable:true,value:wrapped})}catch{try{navigator.share=wrapped}catch{}}
  }

  function installShareLinkBridge(){
    if(document.documentElement.dataset.controlPhiShareLinks==='1')return;
    document.documentElement.dataset.controlPhiShareLinks='1';
    document.addEventListener('click',event=>{
      const anchor=event.target&&event.target.closest?event.target.closest('a[href]'):null;
      if(!anchor)return;
      let shareUrl;
      try{shareUrl=new URL(anchor.href,location.href)}catch{return}
      if(!/(twitter\.com\/intent\/tweet|x\.com\/intent\/post|facebook\.com\/sharer|linkedin\.com\/sharing|reddit\.com\/submit|mailto:)/i.test(shareUrl.href))return;
      const platform=platformFromHref(shareUrl.href);
      let target=location.href;
      if(shareUrl.protocol!=='mailto:')target=shareUrl.searchParams.get('url')||shareUrl.searchParams.get('u')||location.href;
      const plan=sharePlan({title:document.title,text:nowPlaying()||pageMeta('description'),url:target,image:pageMeta('og:image')||pageMeta('twitter:image'),channel:pageChannel()},platform);
      if(shareUrl.protocol!=='mailto:'){
        if(shareUrl.searchParams.has('u'))shareUrl.searchParams.set('u',plan.payload.url);else shareUrl.searchParams.set('url',plan.payload.url);
        anchor.href=shareUrl.href;
      }
      recordShare({...plan.payload,id:plan.id,trackingUrl:plan.trackingUrl,shareConfirmed:false,shareMethod:'share_link',platform});
    },true);
  }

  function installCrossTabBridge(){
    window.addEventListener('storage',event=>{
      if(event.key===SHARE_KEY)window.dispatchEvent(new CustomEvent('controlphi:shared',{detail:{external:true}}));
      if(event.key===INTEREST_KEY)window.dispatchEvent(new CustomEvent('newsphi:interest',{detail:{external:true}}));
      if([WALLET_GUEST_KEY,WALLET_USERS_KEY,WALLET_SESSION_KEY,'c13b0_infinity_token_ledger_v3','infinityPhi:searchTokens:v1','omniPhi:history:v1','quantaPhiBuildHistoryV1','infinity_unified_wallet_v1','infinity_unified_token_count_v3'].includes(event.key||''))refreshWalletUI();
    });
    window.addEventListener('starquest:share-progress',refreshWalletUI);
    window.addEventListener('controlphi:wallet-change',refreshWalletUI);
    window.addEventListener('infinity-shop-cart-updated',()=>{reconcileCollectedAds();injectWalletIntoMenu()});
  }

  function injectCosmo(){
    if(document.querySelector('script[data-control-phi-cosmo]'))return;
    const script=document.createElement('script');
    script.src=`${ROOT}Cosmo/channel-loader.js?v=20260914-editor2`;
    script.dataset.controlPhiCosmo='1';
    document.body.appendChild(script);
  }

  function injectChannelGuide(){
    if(document.querySelector('script[data-control-phi-guide]'))return;
    const script=document.createElement('script');
    script.src=`${ASSET_ROOT}channel-guide.js?v=20260914-guide1`;
    script.dataset.controlPhiGuide='1';
    document.body.appendChild(script);
  }

  function injectRemote(){
    injectWallet();
    injectCosmo();
    injectChannelGuide();
    if(document.getElementById('controlPhiButton'))return;
    const existingMenu=document.querySelector('details.channel-menu, details[data-channel-menu]');
    if(existingMenu){
      const nav=existingMenu.querySelector('nav')||existingMenu.appendChild(document.createElement('nav'));
      const filter=existingMenu.querySelector('input[type="search"]');
      fetch(`${ASSET_ROOT}channels.json`,{cache:'no-store'}).then(r=>r.ok?r.json():Promise.reject()).then(data=>{
        nav.innerHTML=data.channels.map(item=>`<a href="${ROOT}${encodeURIComponent(item.path).replace(/%2F/g,'/')}/" data-name="${item.name.toLowerCase()}">${item.name}</a>`).join('');
        injectWalletIntoMenu();
        if(filter)filter.dispatchEvent(new Event('input'));
      }).catch(()=>{});
      existingMenu.dataset.controlPhi='connected';
      return;
    }
    const css=document.createElement('link');css.rel='stylesheet';css.href=`${ASSET_ROOT}control-phi.css`;document.head.appendChild(css);
    const button=document.createElement('button');button.id='controlPhiButton';button.type='button';button.setAttribute('aria-label','Open Control Phi channels');button.setAttribute('aria-expanded','false');button.textContent='☰';
    const panel=document.createElement('aside');panel.id='controlPhiPanel';panel.setAttribute('aria-hidden','true');panel.innerHTML='<div class="control-phi-head"><strong>Control Phi</strong><button type="button" aria-label="Close channels">×</button></div><p class="control-phi-news">Completed shares feed <a href="'+NEWS_URL+'">News Phi</a> while outward links keep the original channel source and preview.</p><input class="control-phi-search" type="search" placeholder="Find a channel" aria-label="Find a channel"><nav class="control-phi-links" aria-label="Infinity channels"><a href="'+NEWS_URL+'">News Phi</a></nav>';
    document.body.append(button,panel);
    const toggle=(open)=>{panel.classList.toggle('open',open);panel.setAttribute('aria-hidden',String(!open));button.setAttribute('aria-expanded',String(open))};
    button.addEventListener('click',()=>toggle(!panel.classList.contains('open')));panel.querySelector('.control-phi-head button').addEventListener('click',()=>toggle(false));
    const nav=panel.querySelector('.control-phi-links');const input=panel.querySelector('input');
    fetch(`${ASSET_ROOT}channels.json`,{cache:'no-store'}).then(r=>r.ok?r.json():Promise.reject()).then(data=>{nav.innerHTML=data.channels.map(item=>`<a href="${ROOT}${encodeURIComponent(item.path).replace(/%2F/g,'/')}/" data-name="${item.name.toLowerCase()}">${item.name}</a>`).join('');injectWalletIntoMenu();filter()}).catch(()=>{});
    function filter(){const term=input.value.trim().toLowerCase();nav.querySelectorAll('a').forEach(a=>a.hidden=!!term&&!a.textContent.toLowerCase().includes(term))}input.addEventListener('input',filter);
  }

  const AD_PHI_ENDPOINT='https://ad-phi.marvaseater.workers.dev';
  const SENSITIVE_AD_TOPICS=/\b(politic|election|religion|health|medical|sexual|race|ethnic|disability|addiction)\b/i;
  function safeAdTopic(input){
    const value=String(input||'').trim().toLowerCase().replace(/\s+/g,' ').slice(0,80);
    return value&&!SENSITIVE_AD_TOPICS.test(value)?value:'';
  }
  async function requestSponsoredCard(topic,placement='phi'){
    const safe=safeAdTopic(topic);if(!safe)return null;
    const url=AD_PHI_ENDPOINT+'/v1/ads/next?topic='+encodeURIComponent(safe)+'&placement='+encodeURIComponent(String(placement||'phi').slice(0,80));
    const response=await fetch(url,{cache:'no-store',credentials:'omit'});
    const payload=await response.json().catch(()=>({}));
    return response.ok&&payload?.ad?payload.ad:null;
  }
  async function renderSponsoredCard(host,topic,placement='phi'){
    const el=typeof host==='string'?document.querySelector(host):host;if(!el)return null;
    const ad=await requestSponsoredCard(topic,placement).catch(()=>null);
    if(!ad){el.replaceChildren();el.hidden=true;return null}
    el.hidden=false;el.replaceChildren();
    const card=document.createElement('article');card.className='control-phi-sponsored-card';
    const label=document.createElement('small');label.textContent='SPONSORED';
    const title=document.createElement('strong');title.textContent=String(ad.title||'Sponsored');
    const body=document.createElement('p');body.textContent=String(ad.body||'');
    const link=document.createElement('a');link.href=String(ad.destinationUrl||'#');link.target='_blank';link.rel='noopener sponsored';link.textContent=String(ad.advertiser||'Visit advertiser');
    card.append(label,title,body,link);el.append(card);return ad;
  }
  function latestExplicitAdTopic(){
    const items=read(INTEREST_KEY,[]);
    if(!Array.isArray(items))return '';
    for(let i=items.length-1;i>=0;i--){const x=items[i]||{};const t=safeAdTopic(x.query||x.title||x.topic||x.reference||'');if(t)return t}
    return '';
  }
  function installSponsoredSlot(){
    if(document.querySelector('[data-control-phi-ad]'))return;
    const host=document.createElement('aside');host.dataset.controlPhiAd='1';host.setAttribute('aria-label','Sponsored');
    host.style.cssText='margin:12px auto;padding:10px;max-width:760px;border:1px solid rgba(127,127,127,.35);border-radius:12px;';
    const mount=()=>{if(!document.body.contains(host))document.body.appendChild(host);const t=latestExplicitAdTopic();if(t)renderSponsoredCard(host,t,location.pathname).catch(()=>{});else host.hidden=true};
    mount();setInterval(mount,30000);
  }
  window.ControlPhi={version:'1.9.0',recordShare,trackingUrl:(input={})=>{const plan=sharePlan(input,input.platform||'share');return plan.trackingUrl},openNews:()=>location.assign(NEWS_URL),shareFeed:()=>read(SHARE_KEY,[]).slice(),interestFeed:()=>read(INTEREST_KEY,[]).slice(),wallet:walletSnapshot,recordActivity,contextFeed:()=>read(CONTEXT_KEY,[]).slice(),ensureShareCredit,ensureActionCredit,reconcileCollectedAds,shopCart,importLegacyStarCoinBalance,refreshWallet:refreshWalletUI,requestSponsoredCard,renderSponsoredCard};
  installShareBridge();
  installShareLinkBridge();
  installCrossTabBridge();
  installContextBridge();
  const boot=()=>{WALLET_ONLY?injectWallet():injectRemote();reconcileCollectedAds();installSponsoredSlot()};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();