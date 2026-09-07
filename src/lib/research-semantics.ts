export type SemanticSource={title:string;url:string;excerpt?:string;kind?:string};
export type SemanticResearch={title?:string;dek?:string;overview?:string;keyTakeaways?:string[];engineering?:string[];context?:string[];findings?:string[];opportunities?:string[];cautions?:string[];next?:string[];sources?:SemanticSource[]};
export type SemanticSection={id:string;role:"introduction"|"facts"|"evidence"|"engineering"|"applications"|"limitations"|"next";heading:string;paragraphs:string[]};
export type WebsiteContentPlan={title:string;dek:string;kind:"science"|"engineering"|"product"|"history"|"general";sections:SemanticSection[]};
const clean=(x:unknown)=>String(x||"").replace(/\s*\[[0-9, -]+\]/g,"").replace(/https?:\/\/\S+/g,"").replace(/\s+/g," ").trim();
const unique=(a:string[])=>a.map(clean).filter(Boolean).filter((v,i,x)=>x.findIndex(y=>y.slice(0,140).toLowerCase()===v.slice(0,140).toLowerCase())===i);
const prose=(x:string)=>unique(String(x||"").split(/\n\n+/).flatMap(block=>{const c=clean(block);if(c.length<=700)return[c];const s=c.split(/(?<=[.!?])\s+(?=[A-Z0-9])/);const out:string[]=[];let p="";for(const sentence of s){if((p+" "+sentence).length>650&&p){out.push(p);p=sentence}else p+=(p?" ":"")+sentence}if(p)out.push(p);return out}));
function kindOf(r:SemanticResearch){const t=[r.title,r.dek,r.overview,...(r.engineering||[])].join(" ").toLowerCase();if(/element|atom|molecule|chemistry|physics|material|oxide|isotope|biology|planet/.test(t))return"science" as const;if(/engineering|system|machine|circuit|software|robot|architecture|device/.test(t))return"engineering" as const;if(/product|business|service|customer|market|brand/.test(t))return"product" as const;if(/history|century|war|born|founded|discovered|ancient/.test(t))return"history" as const;return"general" as const}
export function planResearchWebsite(r:SemanticResearch,titleFallback="Infinity research"):WebsiteContentPlan{const kind=kindOf(r),title=clean(r.title)||titleFallback,dek=clean(r.dek),sections:SemanticSection[]=[];const add=(id:SemanticSection["role"],heading:string,values:string[])=>{const paragraphs=unique(values.flatMap(prose));if(paragraphs.length)sections.push({id,role:id,heading,paragraphs})};
 add("introduction",kind==="science"?`Understanding ${title}`:"Overview",[r.overview||""]);
 add("facts",kind==="science"?"Properties and key findings":"Key findings",[...(r.keyTakeaways||[]),...(r.findings||[])]);
 add("engineering",kind==="science"?"Behavior and engineering significance":"Engineering view",r.engineering||[]);
 add("applications",kind==="product"?"Uses and value":"Context, applications and directions",[...(r.context||[]),...(r.opportunities||[])]);
 add("limitations","Limits, cautions and uncertainty",r.cautions||[]);
 add("next","Questions and next directions",r.next||[]);
 const sourceEvidence=unique((r.sources||[]).map(s=>s.excerpt||"").flatMap(prose));if(sourceEvidence.length)sections.push({id:"evidence",role:"evidence",heading:"Additional research evidence",paragraphs:sourceEvidence});
 return{title,dek,kind,sections};}
