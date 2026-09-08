export type ContextToken = {
  query?: string;
  title?: string;
  paper?: { title?: string; overview?: string; keyTakeaways?: string[] };
};

const elementNames = new Set([
  "hydrogen","helium","boron","carbon","nitrogen","oxygen","fluorine","silicon","sulfur","potassium","calcium","titanium","vanadium","chromium","iron","cobalt","nickel","copper","zinc","arsenic","selenium","yttrium","zirconium","niobium","molybdenum","silver","tin","antimony","iodine","dysprosium","ytterbium","tungsten","rhenium","platinum","gold","mercury","lead","bismuth","uranium"
]);
const chemistryWords = /\b(element|periodic|atomic|atom|isotope|ion|electron|oxide|metal|alloy|molecule|chemical|chemistry|material)\b/i;
const musicWords = /\b(queen|singer|vocalist|album|song|music|band|concert|rock)\b/i;

function textOf(token: ContextToken) {
  return [token.query, token.title, token.paper?.title, token.paper?.overview, ...(token.paper?.keyTakeaways || [])]
    .filter(Boolean).join(" ").toLowerCase();
}

export function resolveContextualQuery(query: string, history: ContextToken[]) {
  const visible = query.trim();
  const q = visible.toLowerCase();
  if (!visible) return { visible, lookup: visible, domain: "general" as const };
  const recent = history.slice(0, 40).map(textOf);
  let chemistry = 0, music = 0;
  for (const text of recent) {
    if (chemistryWords.test(text)) chemistry += 3;
    if (musicWords.test(text)) music += 3;
    for (const name of elementNames) if (new RegExp(`\\b${name}\\b`, "i").test(text)) chemistry += 2;
  }
  const isElementName = elementNames.has(q);
  if (isElementName && (chemistry > music || recent.length === 0)) {
    const lookup = q === "mercury" ? "Mercury chemical element Hg atomic number 80" : `${visible} chemical element periodic table`;
    return { visible, lookup, domain: "chemistry" as const };
  }
  return { visible, lookup: visible, domain: music > chemistry ? "music" as const : "general" as const };
}
