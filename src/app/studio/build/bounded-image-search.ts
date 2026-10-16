export async function boundedImageSearch<T>(search:()=>Promise<T[]>,timeoutMs=5000):Promise<T[]>{
 let timer:ReturnType<typeof setTimeout>|undefined;
 try{return await Promise.race([Promise.resolve().then(search).catch(()=>[] as T[]),new Promise<T[]>(resolve=>{timer=setTimeout(()=>resolve([]),timeoutMs);})]);}
 finally{if(timer!==undefined)clearTimeout(timer);}
}
