"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { appPath } from "@/lib/base-path";
import styles from "./page.module.css";

type ImageResult={id:string;image:string;title:string;sourceUrl:string;provider:string;description:string};
const KEY="infinity_phi_image_selections_v1";
const clean=(v:unknown)=>String(v||"").replace(/\s+/g," ").trim();
function readSelected():ImageResult[]{try{const v=JSON.parse(localStorage.getItem(KEY)||"[]");return Array.isArray(v)?v:[]}catch{return[]}}
function saveSelected(v:ImageResult[]){try{localStorage.setItem(KEY,JSON.stringify(v.slice(-250)));return true}catch{return false}}
export default function InfinityImagesPage(){
 const[query,setQuery]=useState(""),[active,setActive]=useState(""),[items,setItems]=useState<ImageResult[]>([]),[selected,setSelected]=useState<ImageResult[]>([]),[loading,setLoading]=useState(false),[page,setPage]=useState(0);
 useEffect(()=>{setSelected(readSelected());const initial=clean(new URLSearchParams(location.search).get("q"));setQuery(initial);setActive(initial);if(initial)void fetchImages(initial,0,true)},[]);
 const chosen=useMemo(()=>new Set(selected.map(x=>x.id)),[selected]);
 async function fetchImages(term:string,offset=0,replace=true){if(!term)return;setLoading(true);try{const url=`https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(term)}&gsrnamespace=6&gsrlimit=50&gsroffset=${offset}&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=1000&format=json&origin=*`;const r=await fetch(url),j=await r.json();const next:ImageResult[]=Object.values(j.query?.pages||{}).map((raw:any)=>{const info=raw.imageinfo?.[0]||{},m=info.extmetadata||{},desc=clean(String(m.ImageDescription?.value||m.ObjectName?.value||"").replace(/<[^>]+>/g," "));const image=info.thumburl||info.url||"";return{id:image,image,title:clean(String(raw.title||"").replace(/^File:/,""))||term,sourceUrl:info.descriptionurl||"",provider:"Wikimedia Commons",description:desc}}).filter(x=>x.image);setItems(old=>replace?next:[...old,...next.filter(x=>!old.some(y=>y.id===x.id))]);}finally{setLoading(false)}}
 function submit(e:FormEvent){e.preventDefault();const q=clean(query);if(!q)return;setActive(q);setPage(0);const u=new URL(location.href);u.pathname=appPath("phi/images");u.search="";u.searchParams.set("q",q);history.replaceState({},"",u);void fetchImages(q,0,true)}
 function toggle(item:ImageResult){const current=readSelected(),exists=current.some(x=>x.id===item.id),next=exists?current.filter(x=>x.id!==item.id):[...current,item];if(saveSelected(next))setSelected(next)}
 function more(){const n=page+1;setPage(n);void fetchImages(active,n*50,false)}
 return <main className={styles.shell}><header className={styles.top}><a href={appPath("phi")} className={styles.back}>← Infinity Phi</a><b>{selected.length} selected</b></header><section className={styles.hero}><small>INFINITY PHI IMAGES</small><h1>{active?`Images for ${active}`:"Image Search"}</h1><p>Precise visual results inside Infinity Phi. Select images here without leaving the Infinity system.</p><form onSubmit={submit} className={styles.search}><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search images" autoFocus/><button>Search Images</button></form></section><section className={styles.grid}>{items.map(item=><button type="button" key={item.id} className={`${styles.card} ${chosen.has(item.id)?styles.selected:""}`} onClick={()=>toggle(item)} aria-pressed={chosen.has(item.id)}><img src={item.image} alt={item.title} loading="lazy"/><span><b>{item.title}</b>{item.description&&<small>{item.description.slice(0,150)}</small>}</span>{chosen.has(item.id)&&<i>✓</i>}</button>)}{loading&&<div className={styles.notice}>Finding images…</div>}{!loading&&active&&!items.length&&<div className={styles.notice}>No images yet. Try another wording.</div>}</section>{items.length>0&&<button className={styles.more} onClick={more} disabled={loading}>Load more images ↓</button>}</main>
}
