"use client";

import { useEffect, useState } from "react";
import { Mail, MapPin, Menu, Phone, UserRound, X } from "lucide-react";
import { loadInfinityProfile, publicPublicationContext } from "@/lib/infinity-profile";
import styles from "./PhiPublicationMenu.module.css";

type PublicIdentity={name:string;about:string;email:string;phone:string;website:string;address:string};
const EMPTY:PublicIdentity={name:"",about:"",email:"",phone:"",website:"",address:""};

export default function PhiPublicationMenu(){
  const[open,setOpen]=useState(false);const[identity,setIdentity]=useState<PublicIdentity>(EMPTY);
  useEffect(()=>{void loadInfinityProfile().then((profile)=>setIdentity(publicPublicationContext(profile))).catch(()=>{})},[]);
  const hasPublic=Boolean(identity.name||identity.about||identity.email||identity.phone||identity.website||identity.address);
  return <>
    <button type="button" className={styles.trigger} onClick={()=>setOpen(true)} aria-label="Open publication About and Contact"><Menu size={21}/></button>
    {open&&<div className={styles.backdrop} onMouseDown={()=>setOpen(false)}><aside className={styles.drawer} onMouseDown={(event)=>event.stopPropagation()}>
      <div className={styles.top}><div><small>ABOUT THIS PUBLICATION</small><b>{identity.name||"Publisher profile"}</b></div><button type="button" onClick={()=>setOpen(false)} aria-label="Close"><X/></button></div>
      {hasPublic?<>
        {identity.about&&<section><UserRound/><div><h2>About</h2><p>{identity.about}</p></div></section>}
        <div className={styles.contacts}>
          {identity.website&&<a href={identity.website} target="_blank" rel="noreferrer"><span>↗</span><div><small>Website</small><b>{identity.website}</b></div></a>}
          {identity.email&&<a href={`mailto:${identity.email}`}><Mail/><div><small>Email</small><b>{identity.email}</b></div></a>}
          {identity.phone&&<a href={`tel:${identity.phone}`}><Phone/><div><small>Phone</small><b>{identity.phone}</b></div></a>}
          {identity.address&&<div className={styles.contact}><MapPin/><div><small>Location</small><b>{identity.address}</b></div></div>}
        </div>
      </>:<p className={styles.empty}>The publisher has not added public About or Contact information to this publication.</p>}
    </aside></div>}
  </>;
}
