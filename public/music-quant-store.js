(function(global){
'use strict';
const DB_NAME='infinity-radio-data',STORE='music-quants',LEGACY='musicPhi:quants:v1';
function open(){return new Promise((resolve,reject)=>{const request=indexedDB.open(DB_NAME,1);request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE,{keyPath:'id'})};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error||new Error('indexed_db_unavailable'))})}
async function transaction(mode,work){const db=await open();return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,mode),store=tx.objectStore(STORE);let result;try{result=work(store)}catch(error){db.close();reject(error);return}tx.oncomplete=()=>{db.close();resolve(result)};tx.onerror=()=>{db.close();reject(tx.error||new Error('indexed_db_write_failed'))};tx.onabort=tx.onerror})}
async function list(){const db=await open();return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readonly'),request=tx.objectStore(STORE).getAll();request.onsuccess=()=>resolve((request.result||[]).sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||''))));request.onerror=()=>reject(request.error);tx.oncomplete=()=>db.close()})}
const put=record=>transaction('readwrite',store=>store.put(record));
const putMany=records=>transaction('readwrite',store=>(records||[]).forEach(record=>record?.id&&store.put(record)));
async function migrate(){let legacy=[];try{legacy=JSON.parse(localStorage.getItem(LEGACY)||'[]')||[]}catch{}if(legacy.length)await putMany(legacy);return list()}
global.MusicQuantStore={list,put,putMany,ready:migrate()};
})(window);
