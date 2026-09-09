import { BUILDER_PLUGIN_SLOTS, createVariationPlan, type BuildHistorySignal, type SiteUpgrade, type VariationPlan } from "../../src/lib/site-variation";

type D1Result<T = Record<string, unknown>> = { results?: T[]; success: boolean; meta?: { changes?: number } };
type Statement = { bind(...values: unknown[]): Statement; first<T = Record<string, unknown>>(): Promise<T | null>; all<T = Record<string, unknown>>(): Promise<D1Result<T>>; run(): Promise<D1Result> };
type D1 = { prepare(sql: string): Statement; batch(statements: Statement[]): Promise<D1Result[]> };
type Ai = { run(model: string, input: unknown): Promise<unknown> };
type Env = {
  DB: D1;
  AI?: Ai;
  AI_MODEL?: string;
  ADMIN_SECRET: string;
  CORS_ORIGINS?: string;
  PLUGIN_ENDPOINTS_JSON?: string;
  PLUGIN_SERVICE_TOKEN?: string;
};

type Session = { user_id: string };
type Json = Record<string, unknown>;

const json = (value: unknown, status = 200, headers: HeadersInit = {}) => new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json; charset=utf-8", ...headers } });
const text = (value: unknown) => String(value ?? "").trim();
const now = () => new Date().toISOString();
const id = (prefix: string) => `${prefix}_${crypto.randomUUID()}`;

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function cors(request: Request, env: Env): HeadersInit {
  const origin = request.headers.get("origin") || "";
  const allowed = new Set((env.CORS_ORIGINS || "").split(",").map((item) => item.trim()).filter(Boolean));
  if (!origin || !allowed.has(origin)) return {};
  return { "access-control-allow-origin": origin, "access-control-allow-headers": "authorization, content-type", "access-control-allow-methods": "GET, POST, OPTIONS", vary: "Origin" };
}

async function body(request: Request): Promise<Json> {
  const parsed = await request.json();
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("INVALID_JSON_BODY");
  return parsed as Json;
}

async function session(request: Request, env: Env): Promise<Session | null> {
  const bearer = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1] || "";
  if (!bearer) return null;
  return env.DB.prepare("SELECT user_id FROM api_sessions WHERE token_hash = ? AND expires_at > ?").bind(await sha256(bearer), now()).first<Session>();
}

function stringList(value: unknown, limit = 20): string[] {
  return Array.isArray(value) ? value.map(text).filter(Boolean).slice(0, limit) : [];
}

function upgrades(value: unknown): SiteUpgrade[] {
  const allowed = new Set<SiteUpgrade>(["business", "storefront", "illustration", "tools", "advertising", "real-world-assets"]);
  return stringList(value).filter((item): item is SiteUpgrade => allowed.has(item as SiteUpgrade));
}

async function userHistory(env: Env, userId: string): Promise<BuildHistorySignal[]> {
  const result = await env.DB.prepare("SELECT query, action, selected_aim AS selectedAim, occurred_at AS occurredAt FROM user_history WHERE user_id = ? ORDER BY occurred_at DESC LIMIT 80").bind(userId).all<BuildHistorySignal>();
  return (result.results || []).reverse();
}

async function priorFingerprints(env: Env, userId: string): Promise<string[]> {
  const result = await env.DB.prepare("SELECT fingerprint FROM site_builds WHERE user_id = ? ORDER BY created_at DESC LIMIT 120").bind(userId).all<{ fingerprint: string }>();
  return (result.results || []).map((row) => row.fingerprint);
}

function fallbackScript(query: string, aims: string[], plan: VariationPlan) {
  const subjects = aims.length ? aims : [query];
  return {
    title: query,
    structure: plan.narrative,
    sections: subjects.map((aim, index) => ({
      id: `section-${index + 1}`,
      heading: aim,
      brief: `Explain ${aim} in direct language, then attach evidence, an illustration, and a Phi expansion point.`,
      illustrationDirection: `${plan.illustration}: ${aim}`,
      evidenceRequired: true,
    })),
  };
}

async function generateScript(env: Env, query: string, aims: string[], plan: VariationPlan, history: BuildHistorySignal[]) {
  if (!env.AI || !env.AI_MODEL) return fallbackScript(query, aims, plan);
  const prompt = {
    system: "Create a concise illustrated teaching script. Preserve the exact subject, distinguish sourced facts from proposals, avoid unsupported scientific claims, and return JSON only with title and sections. Each section needs heading, brief, illustrationDirection, evidenceRequired, and phiPrompt.",
    subject: query,
    aims,
    variation: plan,
    relevantHistoryTerms: plan.historyTerms,
    recentHistory: history.slice(-12),
  };
  return env.AI.run(env.AI_MODEL, { messages: [{ role: "user", content: JSON.stringify(prompt) }], response_format: { type: "json_object" } });
}

async function runPlugins(env: Env, plan: VariationPlan, payload: Json): Promise<Record<string, unknown>> {
  let configured: Record<string, string> = {};
  try { configured = JSON.parse(env.PLUGIN_ENDPOINTS_JSON || "{}"); } catch {}
  const selected = plan.plugins.filter((name) => BUILDER_PLUGIN_SLOTS.includes(name as typeof BUILDER_PLUGIN_SLOTS[number]) && /^https:\/\//.test(configured[name] || ""));
  const settled = await Promise.allSettled(selected.map(async (name) => {
    const response = await fetch(configured[name], {
      method: "POST",
      headers: { "content-type": "application/json", ...(env.PLUGIN_SERVICE_TOKEN ? { authorization: `Bearer ${env.PLUGIN_SERVICE_TOKEN}` } : {}) },
      body: JSON.stringify({ role: name, plan, payload }),
    });
    if (!response.ok) throw new Error(`${name}:${response.status}`);
    return [name, await response.json()] as const;
  }));
  return Object.fromEntries(settled.flatMap((result) => result.status === "fulfilled" ? [result.value] : []));
}

async function createBuild(env: Env, userId: string, input: Json, forcedUpgrades: SiteUpgrade[] = []) {
  const tokenId = text(input.tokenId);
  const query = text(input.query);
  const aims = stringList(input.aims, 24);
  if (!tokenId || !query) throw new Error("TOKEN_AND_QUERY_REQUIRED");
  const selectedUpgrades = [...new Set([...upgrades(input.upgrades), ...forcedUpgrades])];
  const history = [...await userHistory(env, userId), ...(Array.isArray(input.history) ? input.history.slice(-40) as BuildHistorySignal[] : [])];
  const plan = createVariationPlan({ userId, tokenId, query, aims, history, priorFingerprints: await priorFingerprints(env, userId), upgrades: selectedUpgrades });
  const script = await generateScript(env, query, aims, plan, history);
  const pluginResults = await runPlugins(env, plan, input);
  const buildId = id("build");
  await env.DB.prepare("INSERT INTO site_builds (id, user_id, token_id, query, aims_json, upgrades_json, variation_json, fingerprint, script_json, plugin_results_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(buildId, userId, tokenId, query, JSON.stringify(aims), JSON.stringify(selectedUpgrades), JSON.stringify(plan), plan.fingerprint, JSON.stringify(script), JSON.stringify(pluginResults), now()).run();
  return { buildId, plan, script, pluginResults };
}

async function handle(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  if (request.method === "GET" && url.pathname === "/health") return json({ ok: true, service: "infinity-personalized-builder", pluginSlots: BUILDER_PLUGIN_SLOTS.length });

  if (request.method === "POST" && url.pathname === "/v1/admin/session") {
    if (!env.ADMIN_SECRET || request.headers.get("x-infinity-admin") !== env.ADMIN_SECRET) return json({ error: "FORBIDDEN" }, 403);
    const input = await body(request);
    const userId = text(input.userId) || id("user");
    const walletId = text(input.walletId) || id("wallet");
    const displayName = text(input.displayName) || "Infinity user";
    const token = `${id("session")}.${crypto.randomUUID()}`;
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    await env.DB.batch([
      env.DB.prepare("INSERT OR IGNORE INTO users (id, display_name) VALUES (?, ?)").bind(userId, displayName),
      env.DB.prepare("INSERT OR IGNORE INTO wallets (id, user_id, display_name) VALUES (?, ?, ?)").bind(walletId, userId, `${displayName} wallet`),
      env.DB.prepare("INSERT OR IGNORE INTO wallet_balances (wallet_id, units) VALUES (?, 0)").bind(walletId),
      env.DB.prepare("INSERT INTO api_sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)").bind(await sha256(token), userId, expiresAt),
    ]);
    return json({ userId, walletId, sessionToken: token, expiresAt }, 201);
  }

  if (request.method === "POST" && url.pathname === "/v1/admin/issue") {
    if (!env.ADMIN_SECRET || request.headers.get("x-infinity-admin") !== env.ADMIN_SECRET) return json({ error: "FORBIDDEN" }, 403);
    const input = await body(request);
    const recipientWalletId = text(input.recipientWalletId);
    const idempotencyKey = text(input.idempotencyKey);
    const units = Number(input.units);
    if (!recipientWalletId || !idempotencyKey || !Number.isSafeInteger(units) || units <= 0) return json({ error: "VALID_ISSUANCE_REQUIRED" }, 400);
    const recipient = await env.DB.prepare("SELECT id FROM wallets WHERE id = ?").bind(recipientWalletId).first<{ id: string }>();
    if (!recipient) return json({ error: "RECIPIENT_NOT_FOUND" }, 404);
    const existing = await env.DB.prepare("SELECT id, status FROM ledger_transfers WHERE idempotency_scope = 'ADMIN' AND idempotency_key = ?").bind(idempotencyKey).first<{ id: string; status: string }>();
    if (existing) return json({ transferId: existing.id, status: existing.status });
    const transferId = id("issuance");
    const timestamp = now();
    await env.DB.batch([
      env.DB.prepare("INSERT INTO ledger_transfers (id, idempotency_key, idempotency_scope, sender_wallet_id, recipient_wallet_id, token_id, units, memo, kind, status, created_at) VALUES (?, ?, 'ADMIN', NULL, ?, ?, ?, ?, 'ISSUE', 'COMPLETED', ?)").bind(transferId, idempotencyKey, recipientWalletId, text(input.tokenId) || null, units, text(input.memo).slice(0, 500), timestamp),
      env.DB.prepare("INSERT INTO ledger_entries (id, transfer_id, wallet_id, direction, units, created_at) VALUES (?, ?, ?, 'CREDIT', ?, ?)").bind(id("entry"), transferId, recipientWalletId, units, timestamp),
    ]);
    return json({ transferId, status: "COMPLETED" }, 201);
  }

  const active = await session(request, env);
  if (!active) return json({ error: "AUTHENTICATION_REQUIRED" }, 401);

  if (request.method === "POST" && url.pathname === "/v1/history/events") {
    const input = await body(request);
    const query = text(input.query);
    if (!query) return json({ error: "QUERY_REQUIRED" }, 400);
    const eventId = id("history");
    await env.DB.prepare("INSERT INTO user_history (id, user_id, query, action, selected_aim, token_id, occurred_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .bind(eventId, active.user_id, query, text(input.action) || "SEARCH", text(input.selectedAim) || null, text(input.tokenId) || null, now()).run();
    return json({ eventId }, 201);
  }

  if (request.method === "POST" && url.pathname === "/v1/builds/plan") {
    return json(await createBuild(env, active.user_id, await body(request)), 201);
  }

  if (request.method === "POST" && url.pathname === "/v1/storefronts") {
    const input = await body(request);
    const business = input.business && typeof input.business === "object" ? input.business as Json : {};
    const businessName = text(business.name);
    if (!businessName) return json({ error: "BUSINESS_NAME_REQUIRED" }, 400);
    const wallet = await env.DB.prepare("SELECT id FROM wallets WHERE user_id = ? ORDER BY created_at LIMIT 1").bind(active.user_id).first<{ id: string }>();
    if (!wallet) return json({ error: "WALLET_REQUIRED" }, 409);
    const built = await createBuild(env, active.user_id, input, ["business", "storefront"]);
    const storefrontId = id("storefront");
    const timestamp = now();
    await env.DB.prepare("INSERT INTO storefronts (id, user_id, wallet_id, site_build_id, token_id, business_name, description, catalog_json, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', ?, ?)")
      .bind(storefrontId, active.user_id, wallet.id, built.buildId, text(input.tokenId), businessName, text(business.description), JSON.stringify(Array.isArray(business.catalog) ? business.catalog : []), timestamp, timestamp).run();
    return json({ storefrontId, ...built }, 201);
  }

  if (request.method === "POST" && url.pathname === "/v1/transfers") {
    const input = await body(request);
    const senderWalletId = text(input.senderWalletId);
    const recipientWalletId = text(input.recipientWalletId);
    const idempotencyKey = text(input.idempotencyKey);
    const units = Number(input.units);
    if (!senderWalletId || !recipientWalletId || !idempotencyKey || !Number.isSafeInteger(units) || units <= 0) return json({ error: "VALID_TRANSFER_REQUIRED" }, 400);
    if (senderWalletId === recipientWalletId) return json({ error: "RECIPIENT_MUST_DIFFER" }, 400);
    const owned = await env.DB.prepare("SELECT id FROM wallets WHERE id = ? AND user_id = ?").bind(senderWalletId, active.user_id).first<{ id: string }>();
    if (!owned) return json({ error: "SENDER_WALLET_NOT_OWNED" }, 403);
    const recipient = await env.DB.prepare("SELECT id FROM wallets WHERE id = ?").bind(recipientWalletId).first<{ id: string }>();
    if (!recipient) return json({ error: "RECIPIENT_NOT_FOUND" }, 404);
    const existing = await env.DB.prepare("SELECT id, status FROM ledger_transfers WHERE idempotency_scope = ? AND idempotency_key = ?").bind(senderWalletId, idempotencyKey).first<{ id: string; status: string }>();
    if (existing) {
      const balance = await env.DB.prepare("SELECT units FROM wallet_balances WHERE wallet_id = ?").bind(senderWalletId).first<{ units: number }>();
      return json({ transferId: existing.id, status: existing.status, senderBalance: balance?.units || 0 });
    }
    const transferId = id("transfer");
    const timestamp = now();
    try {
      await env.DB.batch([
        env.DB.prepare("INSERT INTO ledger_transfers (id, idempotency_key, idempotency_scope, sender_wallet_id, recipient_wallet_id, token_id, units, memo, kind, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'TRANSFER', 'COMPLETED', ?)").bind(transferId, idempotencyKey, senderWalletId, senderWalletId, recipientWalletId, text(input.tokenId) || null, units, text(input.memo).slice(0, 500), timestamp),
        env.DB.prepare("INSERT INTO ledger_entries (id, transfer_id, wallet_id, direction, units, created_at) VALUES (?, ?, ?, 'DEBIT', ?, ?)").bind(id("entry"), transferId, senderWalletId, units, timestamp),
        env.DB.prepare("INSERT INTO ledger_entries (id, transfer_id, wallet_id, direction, units, created_at) VALUES (?, ?, ?, 'CREDIT', ?, ?)").bind(id("entry"), transferId, recipientWalletId, units, timestamp),
      ]);
    } catch (error) {
      if (String(error).includes("INSUFFICIENT_BALANCE")) return json({ error: "INSUFFICIENT_BALANCE" }, 409);
      throw error;
    }
    const balance = await env.DB.prepare("SELECT units FROM wallet_balances WHERE wallet_id = ?").bind(senderWalletId).first<{ units: number }>();
    return json({ transferId, status: "COMPLETED", senderBalance: balance?.units || 0 }, 201);
  }

  if (request.method === "GET" && url.pathname.startsWith("/v1/wallets/") && url.pathname.endsWith("/balance")) {
    const walletId = decodeURIComponent(url.pathname.slice("/v1/wallets/".length, -"/balance".length));
    const result = await env.DB.prepare("SELECT w.id AS walletId, b.units FROM wallets w JOIN wallet_balances b ON b.wallet_id = w.id WHERE w.id = ? AND w.user_id = ?").bind(walletId, active.user_id).first();
    return result ? json(result) : json({ error: "WALLET_NOT_FOUND" }, 404);
  }

  return json({ error: "NOT_FOUND" }, 404);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const headers = cors(request, env);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    try {
      const response = await handle(request, env);
      Object.entries(headers).forEach(([key, value]) => response.headers.set(key, String(value)));
      response.headers.set("cache-control", "no-store");
      return response;
    } catch (error) {
      console.error("Infinity builder request failed", error);
      return json({ error: "INTERNAL_ERROR" }, 500, headers);
    }
  },
};
