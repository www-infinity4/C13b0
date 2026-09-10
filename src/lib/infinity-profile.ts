import { secureLoadDurable, secureSaveDurable } from "@/lib/secure-storage";

export type InfinityBusiness={
  id:string;
  name:string;
  contactName:string;
  email:string;
  phone:string;
  address1:string;
  address2:string;
  city:string;
  region:string;
  postalCode:string;
  country:string;
  website:string;
  workspace:string;
  notes:string;
};

export type InfinityProfile={
  version:1;
  displayName:string;
  legalName:string;
  email:string;
  phone:string;
  address1:string;
  address2:string;
  city:string;
  region:string;
  postalCode:string;
  country:string;
  signature:string;
  contextNotes:string;
  activeBusinessId:string;
  activeWebsite:string;
  businesses:InfinityBusiness[];
  updated:number;
};

export const PROFILE_KEY="infinity_identity_profile_v1";

export const EMPTY_PROFILE:InfinityProfile={
  version:1,displayName:"",legalName:"",email:"",phone:"",address1:"",address2:"",city:"",region:"",postalCode:"",country:"",signature:"",contextNotes:"",activeBusinessId:"",activeWebsite:"",businesses:[],updated:0,
};

export function blankBusiness(name=""):InfinityBusiness{return{id:`business-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,name,contactName:"",email:"",phone:"",address1:"",address2:"",city:"",region:"",postalCode:"",country:"",website:"",workspace:"",notes:""};}

export async function loadInfinityProfile():Promise<InfinityProfile>{
  const stored=await secureLoadDurable<InfinityProfile>(PROFILE_KEY,EMPTY_PROFILE).catch(()=>EMPTY_PROFILE);
  return {...EMPTY_PROFILE,...stored,businesses:Array.isArray(stored?.businesses)?stored.businesses:[]};
}

export async function saveInfinityProfile(profile:InfinityProfile){
  const next={...profile,version:1 as const,updated:Date.now()};
  await secureSaveDurable(PROFILE_KEY,next);
  if(typeof window!=="undefined")window.dispatchEvent(new CustomEvent("infinity-profile-updated",{detail:next}));
  return next;
}

export function activeBusiness(profile:InfinityProfile){return profile.businesses.find((business)=>business.id===profile.activeBusinessId)||profile.businesses[0]||null;}

export function fullAddress(value:{address1:string;address2:string;city:string;region:string;postalCode:string;country:string}){
  return [value.address1,value.address2,[value.city,value.region,value.postalCode].filter(Boolean).join(" "),value.country].filter(Boolean).join(", ");
}

export function profileContext(profile:InfinityProfile){
  const business=activeBusiness(profile);
  return {
    personName:profile.displayName||profile.legalName,
    legalName:profile.legalName||profile.displayName,
    personEmail:profile.email,
    personPhone:profile.phone,
    personAddress:fullAddress(profile),
    signature:profile.signature||profile.displayName||profile.legalName,
    personContext:profile.contextNotes||"",
    businessName:business?.name||"",
    businessContact:business?.contactName||profile.displayName||profile.legalName,
    businessEmail:business?.email||profile.email,
    businessPhone:business?.phone||profile.phone,
    businessAddress:business?fullAddress(business):fullAddress(profile),
    businessWebsite:profile.activeWebsite||business?.website||"",
    workspace:business?.workspace||"",
    businessNotes:business?.notes||"",
    business,
  };
}

/**
 * Reusable, non-contact AI context. This is safe to use for local routing,
 * ranking and generation without appending private addresses/phone numbers to
 * public search-provider queries.
 */
export function profileContextText(profile:InfinityProfile){
  const ctx=profileContext(profile);
  return [
    ctx.personName&&`User: ${ctx.personName}`,
    ctx.personContext&&`User context: ${ctx.personContext}`,
    ctx.businessName&&`Active business: ${ctx.businessName}`,
    ctx.businessWebsite&&`Active website: ${ctx.businessWebsite}`,
    ctx.workspace&&`Workspace: ${ctx.workspace}`,
    ctx.businessNotes&&`Business context: ${ctx.businessNotes}`,
  ].filter(Boolean).join("\n");
}
