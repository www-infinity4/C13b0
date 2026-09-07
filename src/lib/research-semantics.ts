export type SemanticSource={title:string;url:string;excerpt?:string;kind?:string};
export type SemanticResearch={title?:string;dek?:string;overview?:string;keyTakeaways?:string[];engineering?:string[];context?:string[];findings?:string[];opportunities?:string[];cautions?:string[];next?:string[];sources?:SemanticSource[]};
export type SemanticSection={id:string;role:"introduction"|"facts"|"explanation"|"evidence"|"engineering"|"applications"|"limitations"|"next"|"sources";heading:string;paragraphs:string[];items:string[]};
export type WebsiteContentPlan={title:string;dek:string;kind:"science"|"engineering"|"product"|"history"|"general";sections:SemanticSection[];sources:SemanticSource[]};
const clean=(x:unknown)=>String(x||"").replace(/\[[0-9, -]+\]/g,"").replace(/\s+/g," ").trim();
const unique=(a:string[])=>a.map(clean).filter(Boolean).filter((v,i,x)=>x.findIndex(y=>y.slice(0,100).toLowerCase()===v.slice(0,100).toLowerCase())===i);
const paragraphs=(x:string)=>String(x||"").split(/\n\n+|(?<=[.!?])\s+(?=[A-Z])/).map(clean).filter(v=>v.length>35);
function kindOf(r:SemanticResearch){const t=[r.title,r.dek,r.overview,...(r.engineering||[])].join(" ").toLowerCase();if(/element|atom|molecule|chemistry|physics|material|oxide|isotope|biology|planet/.test(t))return"science" as const;if(/engineering|system|machine|circuit|software|robot|architecture|device/.test(t))return"engineering" as const;if(/product|business|service|customer|market|brand/.test(t))return"product" as const;if(/history|century|war|born|founded|discovered|ancient/.test(t))return"history" as const;return"general" as const}
export function planResearchWebsite(r:SemanticResearch,titleFallback="Infinity research"):WebsiteContentPlan{const kind=kindOf(r),title=clean(r.title)||titleFallback,dek=clean(r.dek),overview=paragraphs(r.overview||""),facts=unique([...(r.keyTakeaways||[]),...(r.findings||[])]),engineering=unique(r.engineering||[]),applications=unique([...(r.context||[]),...(r.opportunities||[])]),limits=unique(r.cautions||[]),next=unique(r.next||[]),sections:SemanticSection[]=[];
 if(overview.length)sections.push({id:"intro",role:"introduction",heading:kind==="science"?`Understanding ${title}`:"Overview",paragraphs:overview.slice(0,5),items:[]});
 if(facts.length)sections.push({id:"facts",role:"facts",heading:kind==="science"?"Key properties and findings":"Key findings",paragraphs:[],items:facts.slice(0,8)});
 if(engineering.length)sections.push({id:"engineering",role:"engineering",heading:kind==="science"?"Behavior and engineering significance":"Engineering view",paragraphs:engineering.slice(0,3),items:engineering.slice(3,8)});
 if(applications.length)sections.push({id:"applications",role:"applications",heading:kind==="product"?"Uses and value":"Applications and directions",paragraphs:applications.slice(0,2),items:applications.slice(2,8)});
 if(limits.length)sections.push({id:"limits",role:"limitations",heading:"Limits, cautions and uncertainty",paragraphs:limits.slice(0,2),items:limits.slice(2,8)});
 if(next.length)sections.push({id:"next",role:"next",heading:"Questions and next directions",paragraphs:[],items:next.slice(0,8)});
 return{title,dek,kind,sections,sources:(r.sources||[]).filter(s=>s?.title&&s?.url).slice(0,20)};
}
