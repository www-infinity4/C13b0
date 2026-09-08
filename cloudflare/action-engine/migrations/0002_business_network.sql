PRAGMA foreign_keys = ON;

-- Infinity Business Pages are stored independently from page build jobs so a
-- business can keep the same identity while its layout and content evolve.
CREATE TABLE IF NOT EXISTS business_sites (
  id TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL,
  owner_wallet_id TEXT NOT NULL,
  website_token_id TEXT NOT NULL UNIQUE,
  business_name TEXT NOT NULL,
  site_type TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  research_query TEXT,
  style_fingerprint TEXT NOT NULL,
  style_profile_json TEXT NOT NULL DEFAULT '{}',
  section_plan_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'review', 'preview-ready', 'published', 'archived')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_business_sites_owner
  ON business_sites (owner_wallet_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_business_sites_actor
  ON business_sites (actor_id, updated_at);

-- Every generation run records the history-derived inputs that selected a
-- design. This prevents a builder from silently falling back to one template
-- and makes repeated sites auditable and intentionally varied.
CREATE TABLE IF NOT EXISTS business_style_runs (
  id TEXT PRIMARY KEY,
  business_site_id TEXT NOT NULL,
  style_fingerprint TEXT NOT NULL,
  style_name TEXT NOT NULL,
  history_terms_json TEXT NOT NULL DEFAULT '[]',
  section_plan_json TEXT NOT NULL DEFAULT '[]',
  variation_nonce INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (business_site_id) REFERENCES business_sites(id)
);

CREATE INDEX IF NOT EXISTS idx_business_style_runs_site
  ON business_style_runs (business_site_id, created_at);

-- External stores are connectors, not copied identities. A connector may
-- expose a public storefront URL immediately; authenticated catalog import or
-- publishing remains disabled until the platform-specific authorization flow
-- is connected and approved.
CREATE TABLE IF NOT EXISTS storefront_connectors (
  id TEXT PRIMARY KEY,
  business_site_id TEXT NOT NULL,
  owner_wallet_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  storefront_url TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'link'
    CHECK (mode IN ('link', 'catalog-import', 'publish-sync')),
  auth_state TEXT NOT NULL DEFAULT 'not-connected'
    CHECK (auth_state IN ('not-connected', 'pending', 'connected', 'revoked')),
  sync_state TEXT NOT NULL DEFAULT 'idle'
    CHECK (sync_state IN ('idle', 'queued', 'syncing', 'complete', 'blocked')),
  last_sync_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (business_site_id) REFERENCES business_sites(id)
);

CREATE INDEX IF NOT EXISTS idx_storefront_connectors_site
  ON storefront_connectors (business_site_id, provider);

-- Cross-user value movement is two-phase. The browser creates an intent; a
-- trusted ledger service must authenticate both sides, verify spendable
-- balance and idempotency, then either settle or reject it. No client can mark
-- its own intent settled.
CREATE TABLE IF NOT EXISTS token_transfer_intents (
  id TEXT PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE,
  actor_id TEXT NOT NULL,
  sender_wallet_id TEXT NOT NULL,
  recipient_wallet_id TEXT NOT NULL,
  website_token_id TEXT,
  amount INTEGER NOT NULL CHECK (amount > 0),
  memo TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'authorized', 'settled', 'rejected', 'cancelled')),
  ledger_receipt_id TEXT,
  rejection_reason TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (sender_wallet_id <> recipient_wallet_id),
  CHECK (status <> 'settled' OR ledger_receipt_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_token_transfer_sender
  ON token_transfer_intents (sender_wallet_id, created_at);
CREATE INDEX IF NOT EXISTS idx_token_transfer_recipient
  ON token_transfer_intents (recipient_wallet_id, created_at);
CREATE INDEX IF NOT EXISTS idx_token_transfer_status
  ON token_transfer_intents (status, created_at);

-- Immutable local copy of the settlement evidence returned by the canonical
-- ledger. The action engine records the receipt but does not mint its own
-- balance.
CREATE TABLE IF NOT EXISTS token_transfer_receipts (
  id TEXT PRIMARY KEY,
  transfer_intent_id TEXT NOT NULL UNIQUE,
  canonical_ledger TEXT NOT NULL,
  canonical_receipt_id TEXT NOT NULL UNIQUE,
  sender_wallet_id TEXT NOT NULL,
  recipient_wallet_id TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK (amount > 0),
  settled_at TEXT NOT NULL,
  receipt_json TEXT NOT NULL,
  FOREIGN KEY (transfer_intent_id) REFERENCES token_transfer_intents(id)
);
