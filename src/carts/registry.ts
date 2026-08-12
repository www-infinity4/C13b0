export type CartStatus = 'ready' | 'partial' | 'recovery-pending';

export type CartDefinition = {
  id: string;
  title: string;
  role: string;
  status: CartStatus;
  requiresApproval: string[];
  capabilities: string[];
};

export const helperCarts: CartDefinition[] = [
  { id:'reader', title:'Reader Cart', role:'Reads approved files, pages, and Crown records into structured evidence.', status:'partial', requiresApproval:[], capabilities:['summarize','extract','cite','identify-deadlines'] },
  { id:'logic', title:'Logic Cart', role:'Separates facts, assumptions, contradictions, and missing information.', status:'partial', requiresApproval:[], capabilities:['classify-claims','detect-conflicts','confidence'] },
  { id:'reasoning', title:'Reasoning Cart', role:'Combines evidence and produces explained options without treating repetition as proof.', status:'partial', requiresApproval:[], capabilities:['compare','plan','explain-choice'] },
  { id:'writer', title:'Writer Cart', role:'Drafts messages, invitations, pages, articles, lists, and announcements.', status:'partial', requiresApproval:['send','publish'], capabilities:['draft','rewrite','tone','website-copy'] },
  { id:'party-planner', title:'Party Planner Cart', role:'Builds guest, theme, food, supply, timing, activity, and budget plans.', status:'ready', requiresApproval:['invite','purchase','schedule'], capabilities:['guest-list','timeline','supplies','budget','invitations'] },
  { id:'calendar', title:'Calendar Cart', role:'Turns approved plans into proposed calendar events after conflict checks.', status:'partial', requiresApproval:['create-event','invite','modify-event'], capabilities:['propose-event','conflict-check'] },
  { id:'shopping', title:'Shopping Cart', role:'Creates categorized owned/needed/optional/purchased lists.', status:'ready', requiresApproval:['purchase'], capabilities:['lists','categories','budget'] },
  { id:'site-builder', title:'Site Builder Cart', role:'Builds mobile-readable previews from approved content and assets.', status:'partial', requiresApproval:['publish','overwrite'], capabilities:['assemble-page','validate-assets','mobile-check'] },
  { id:'auto-assembler', title:'Auto Assembler Cart', role:'Connects registered components using typed inputs and outputs.', status:'partial', requiresApproval:['merge','deploy','overwrite'], capabilities:['component-selection','contract-validation','preview-build'] },
  { id:'autopilot', title:'Autopilot Cart', role:'Runs supervised multi-cart workflows and stops at consequential actions.', status:'partial', requiresApproval:['send','publish','spend','delete','account-change','invite'], capabilities:['route-jobs','draft','organize','preview','activity-log'] },
  { id:'memory', title:'Memory Cart', role:'Stores owner-approved preferences with source, privacy, edit, export, and delete controls.', status:'partial', requiresApproval:['save-sensitive','share'], capabilities:['remember','edit','export','delete','privacy'] },
  { id:'review', title:'Safety and Review Cart', role:'Checks scripts, dependencies, secrets, unsupported claims, and asset rights.', status:'partial', requiresApproval:['override-warning'], capabilities:['security-scan','rights-check','claim-check','path-check'] },
];
