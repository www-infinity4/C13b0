"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Building2, Plus, Save, UserRound } from "lucide-react";
import { appPath } from "@/lib/base-path";
import { InfinityBusiness, InfinityProfile, EMPTY_PROFILE, activeBusiness, blankBusiness, loadInfinityProfile, saveInfinityProfile } from "@/lib/infinity-profile";
import styles from "./PhiProfile.module.css";

const clone=(profile:InfinityProfile):InfinityProfile=>({...profile,businesses:profile.businesses.map((business)=>({...business}))});

export default function PhiProfile(){
  const [profile,setProfile]=useState<InfinityProfile>(EMPTY_PROFILE);
  const [ready,setReady]=useState(false);
  const [status,setStatus]=useState("");
  useEffect(()=>{void loadInfinityProfile().then((value)=>{setProfile(clone(value));setReady(true)})},[]);
  const business=useMemo(()=>activeBusiness(profile),[profile]);
  function person<K extends keyof InfinityProfile>(key:K,value:InfinityProfile[K]){setProfile((current)=>({...current,[key]:value}))}
  function businessField<K extends keyof InfinityBusiness>(key:K,value:InfinityBusiness[K]){if(!business)return;setProfile((current)=>({...current,businesses:current.businesses.map((item)=>item.id===business.id?{...item,[key]:value}:item)}))}
  function addBusiness(){const next=blankBusiness("New business");setProfile((current)=>({...current,activeBusinessId:next.id,businesses:[...current.businesses,next]}))}
  async function submit(event:FormEvent){event.preventDefault();const saved=await saveInfinityProfile(profile);setProfile(clone(saved));setStatus("Profile and active business context saved.")}
  if(!ready)return <main className={styles.page}><div className={styles.loading}>Loading profile…</div></main>;
  return <main className={styles.page}><header><a href={appPath("phi")}><ArrowLeft size={18}/> Infinity</a><div><b>Profile</b><small>Identity · business · workspace context</small></div></header><form onSubmit={submit} className={styles.wrap}>
    <section className={styles.hero}><div><small>REUSABLE CONTEXT</small><h1>Tell Infinity who is creating.</h1><p>These fields prefill invoices, documents, spreadsheets, and software workspace context. Infinity uses saved fields instead of guessing them.</p></div><button type="submit"><Save size={17}/> Save profile</button></section>
    <section className={styles.card}><div className={styles.cardHead}><UserRound/><div><h2>Person</h2><p>Your default personal identity.</p></div></div><div className={styles.grid}>
      <label>Display name<input value={profile.displayName} onChange={(e)=>person("displayName",e.target.value)} placeholder="Name Infinity should use"/></label><label>Legal / billing name<input value={profile.legalName} onChange={(e)=>person("legalName",e.target.value)}/></label><label>Email<input type="email" value={profile.email} onChange={(e)=>person("email",e.target.value)}/></label><label>Phone<input value={profile.phone} onChange={(e)=>person("phone",e.target.value)}/></label><label className={styles.wide}>Address<input value={profile.address1} onChange={(e)=>person("address1",e.target.value)}/></label><label className={styles.wide}>Address line 2<input value={profile.address2} onChange={(e)=>person("address2",e.target.value)}/></label><label>City<input value={profile.city} onChange={(e)=>person("city",e.target.value)}/></label><label>State / region<input value={profile.region} onChange={(e)=>person("region",e.target.value)}/></label><label>Postal code<input value={profile.postalCode} onChange={(e)=>person("postalCode",e.target.value)}/></label><label>Country<input value={profile.country} onChange={(e)=>person("country",e.target.value)}/></label><label className={styles.wide}>Default signature<input value={profile.signature} onChange={(e)=>person("signature",e.target.value)}/></label>
    </div></section>
    <section className={styles.card}><div className={styles.cardHead}><Building2/><div><h2>Business context</h2><p>Choose which business and website the current Create/Code work belongs to.</p></div><button type="button" className={styles.secondary} onClick={addBusiness}><Plus size={16}/> Add business</button></div>
      {profile.businesses.length>0&&<div className={styles.businessTabs}>{profile.businesses.map((item)=><button type="button" key={item.id} className={item.id===profile.activeBusinessId?styles.active:""} onClick={()=>person("activeBusinessId",item.id)}>{item.name||"Unnamed business"}</button>)}</div>}
      {!business?<button type="button" className={styles.addFirst} onClick={addBusiness}><Plus/> Add your first business</button>:<div className={styles.grid}>
        <label>Business name<input value={business.name} onChange={(e)=>businessField("name",e.target.value)}/></label><label>Contact name<input value={business.contactName} onChange={(e)=>businessField("contactName",e.target.value)}/></label><label>Email<input type="email" value={business.email} onChange={(e)=>businessField("email",e.target.value)}/></label><label>Phone<input value={business.phone} onChange={(e)=>businessField("phone",e.target.value)}/></label><label className={styles.wide}>Business address<input value={business.address1} onChange={(e)=>businessField("address1",e.target.value)}/></label><label className={styles.wide}>Address line 2<input value={business.address2} onChange={(e)=>businessField("address2",e.target.value)}/></label><label>City<input value={business.city} onChange={(e)=>businessField("city",e.target.value)}/></label><label>State / region<input value={business.region} onChange={(e)=>businessField("region",e.target.value)}/></label><label>Postal code<input value={business.postalCode} onChange={(e)=>businessField("postalCode",e.target.value)}/></label><label>Country<input value={business.country} onChange={(e)=>businessField("country",e.target.value)}/></label><label className={styles.wide}>Business website<input value={business.website} onChange={(e)=>businessField("website",e.target.value)} placeholder="https://…"/></label><label className={styles.wide}>Workspace / project<input value={business.workspace} onChange={(e)=>businessField("workspace",e.target.value)} placeholder="Business section, repo, project, storefront…"/></label><label className={styles.wide}>Active website for current work<input value={profile.activeWebsite} onChange={(e)=>person("activeWebsite",e.target.value)} placeholder={business.website||"Website this work should belong to"}/></label><label className={styles.wide}>Business notes<textarea value={business.notes} onChange={(e)=>businessField("notes",e.target.value)} placeholder="Default billing terms, brand notes, recurring context…"/></label>
      </div>}
    </section>
    <div className={styles.bottom}><button type="submit"><Save size={17}/> Save profile and business context</button>{status&&<span>{status}</span>}</div>
  </form></main>;
}
