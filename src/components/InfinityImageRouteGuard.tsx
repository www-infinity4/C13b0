"use client";

import { useEffect } from "react";
import PhiSearchRouteGuard from "@/components/PhiSearchRouteGuard";
import { appPath } from "@/lib/base-path";

type SelectedImage={image?:string;original?:string;title?:string;description?:string;sourceUrl?:string;provider?:string};
const BY_QUERY_KEY="infinity_phi_image_selections_by_query_v1";
const OVERVIEW_KEY="infinity_phi_selected_image_overview_v1";

const queryKey=(value:string)=>value.replace(/\s+/g," ").trim().toLowerCase();

function readSelected(query:string):SelectedImage[]{
  try{
    const packet=JSON.parse(localStorage.getItem(OVERVIEW_KEY)||"null");
    if(queryKey(packet?.query||"")===queryKey(query)&&Array.isArray(packet?.images))return packet.images;
    const byQuery=JSON.parse(localStorage.getItem(BY_QUERY_KEY)||"{}");
    const saved=byQuery?.[queryKey(query)];
    return Array.isArray(saved)?saved:[];
  }catch{return[]}
}

export default function InfinityImageRouteGuard() {
  useEffect(() => {
    const guard = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const button = target?.closest("button");
      if (!button) return;
      const label = (button.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
      if (!label.startsWith("images")) return;
      const resultsArea = button.closest("main");
      if (!resultsArea) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      const params = new URLSearchParams(window.location.search);
      const q = params.get("q")?.trim() || "";
      const targetPath = appPath("phi/images");
      window.location.assign(q ? `${targetPath}?q=${encodeURIComponent(q)}` : targetPath);
    };

    document.addEventListener("click", guard, true);

    const params=new URLSearchParams(window.location.search);
    const fromImages=params.get("images")==="selected";
    let observer:MutationObserver|undefined;
    if(fromImages){
      const query=params.get("q")||"";
      const picks=readSelected(query).filter(x=>x.image||x.original);
      if(picks.length){
        document.documentElement.dataset.infinitySelectedImages="true";
        const bind=()=>{
          const main=document.querySelector("main");
          if(!main)return;
          const overview=Array.from(main.querySelectorAll("section")).find(s=>(s.textContent||"").toLowerCase().includes("ai overview"));
          const hero=overview?.querySelector("img") as HTMLImageElement|null;
          if(hero){hero.src=picks[0].image||picks[0].original||hero.src;hero.alt=picks[0].title||hero.alt;}
          const title=overview?.querySelector("h1") as HTMLElement|null;
          if(title){title.style.color="#0f172a";title.style.fontWeight="900";}
        };
        bind();
        observer=new MutationObserver(bind);
        observer.observe(document.body,{childList:true,subtree:true});
      }
    }

    return () => {document.removeEventListener("click", guard, true);observer?.disconnect();};
  }, []);

  return <PhiSearchRouteGuard />;
}
