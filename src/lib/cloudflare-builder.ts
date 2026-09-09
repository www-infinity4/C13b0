import type { BuildHistorySignal, SiteUpgrade, VariationPlan } from "./site-variation";
import type { PluginReceipt } from "./plugin-index";

const API = process.env.NEXT_PUBLIC_INFINITY_BUILDER_API?.replace(/\/$/, "") || "";
const SESSION_KEY = "infinity_cloudflare_session_v1";

export type CloudflareBuildRequest = {
  tokenId: string;
  query: string;
  aims: string[];
  history: BuildHistorySignal[];
  upgrades: SiteUpgrade[];
  business?: { name: string; description: string; catalog?: unknown[] };
};

function sessionToken(): string {
  if (typeof window === "undefined") return "";
  return sessionStorage.getItem(SESSION_KEY) || "";
}

async function apiRequest<T>(path: string, init: RequestInit): Promise<T> {
  if (!API) throw new Error("Cloudflare builder is not configured yet");
  const token = sessionToken();
  if (!token) throw new Error("Sign in to the Cloudflare ledger before using shared actions");
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: { "content-type": "application/json", authorization: `Bearer ${token}`, ...(init.headers || {}) },
  });
  const value = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(String(value?.error || `Cloudflare request failed (${response.status})`));
  return value as T;
}

export function cloudflareBuilderConfigured(): boolean {
  return Boolean(API);
}

export async function requestCloudflareBuild(input: CloudflareBuildRequest): Promise<{ buildId: string; plan: VariationPlan; pluginResults: Record<string, PluginReceipt> }> {
  return apiRequest("/v1/builds/plan", { method: "POST", body: JSON.stringify(input) });
}

export async function saveCloudflareStorefront(input: CloudflareBuildRequest): Promise<{ storefrontId: string; plan: VariationPlan; pluginResults: Record<string, PluginReceipt> }> {
  return apiRequest("/v1/storefronts", { method: "POST", body: JSON.stringify(input) });
}

export async function transferCloudflareTokens(input: {
  senderWalletId: string;
  recipientWalletId: string;
  units: number;
  tokenId?: string;
  memo?: string;
  idempotencyKey: string;
}): Promise<{ transferId: string; status: string; senderBalance: number }> {
  return apiRequest("/v1/transfers", { method: "POST", body: JSON.stringify(input) });
}
