PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS api_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_api_sessions_user
  ON api_sessions (user_id, expires_at);

CREATE TABLE IF NOT EXISTS wallets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_wallets_user
  ON wallets (user_id, created_at);

CREATE TABLE IF NOT EXISTS wallet_balances (
  wallet_id TEXT PRIMARY KEY,
  units INTEGER NOT NULL DEFAULT 0 CHECK (units >= 0),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (wallet_id) REFERENCES wallets(id)
);

CREATE TABLE IF NOT EXISTS ledger_transfers (
  id TEXT PRIMARY KEY,
  idempotency_key TEXT NOT NULL,
  idempotency_scope TEXT NOT NULL,
  sender_wallet_id TEXT,
  recipient_wallet_id TEXT NOT NULL,
  token_id TEXT,
  units INTEGER NOT NULL CHECK (units > 0),
  memo TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL CHECK (kind IN ('ISSUE', 'TRANSFER')),
  status TEXT NOT NULL CHECK (status IN ('COMPLETED', 'REVERSED')),
  created_at TEXT NOT NULL,
  FOREIGN KEY (sender_wallet_id) REFERENCES wallets(id),
  FOREIGN KEY (recipient_wallet_id) REFERENCES wallets(id),
  UNIQUE (idempotency_scope, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_ledger_transfers_recipient
  ON ledger_transfers (recipient_wallet_id, created_at);

CREATE TABLE IF NOT EXISTS ledger_entries (
  id TEXT PRIMARY KEY,
  transfer_id TEXT NOT NULL,
  wallet_id TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('DEBIT', 'CREDIT')),
  units INTEGER NOT NULL CHECK (units > 0),
  created_at TEXT NOT NULL,
  FOREIGN KEY (transfer_id) REFERENCES ledger_transfers(id),
  FOREIGN KEY (wallet_id) REFERENCES wallets(id),
  UNIQUE (transfer_id, wallet_id, direction)
);

CREATE INDEX IF NOT EXISTS idx_ledger_entries_wallet
  ON ledger_entries (wallet_id, created_at);

CREATE TRIGGER IF NOT EXISTS ledger_debit_requires_balance
BEFORE INSERT ON ledger_entries
WHEN NEW.direction = 'DEBIT'
BEGIN
  SELECT CASE
    WHEN COALESCE((SELECT units FROM wallet_balances WHERE wallet_id = NEW.wallet_id), 0) < NEW.units
    THEN RAISE(ABORT, 'INSUFFICIENT_BALANCE')
  END;
END;

CREATE TRIGGER IF NOT EXISTS ledger_entry_updates_balance
AFTER INSERT ON ledger_entries
BEGIN
  UPDATE wallet_balances
  SET units = units + CASE WHEN NEW.direction = 'CREDIT' THEN NEW.units ELSE -NEW.units END,
      updated_at = NEW.created_at
  WHERE wallet_id = NEW.wallet_id;
END;

CREATE TABLE IF NOT EXISTS user_history (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  query TEXT NOT NULL,
  action TEXT NOT NULL,
  selected_aim TEXT,
  token_id TEXT,
  occurred_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_user_history_recent
  ON user_history (user_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS site_builds (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_id TEXT NOT NULL,
  query TEXT NOT NULL,
  aims_json TEXT NOT NULL DEFAULT '[]',
  upgrades_json TEXT NOT NULL DEFAULT '[]',
  variation_json TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  script_json TEXT NOT NULL,
  plugin_results_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_site_builds_user_recent
  ON site_builds (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_site_builds_token
  ON site_builds (token_id, created_at DESC);

CREATE TABLE IF NOT EXISTS storefronts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  wallet_id TEXT NOT NULL,
  site_build_id TEXT NOT NULL,
  token_id TEXT NOT NULL,
  business_name TEXT NOT NULL,
  description TEXT NOT NULL,
  catalog_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL CHECK (status IN ('DRAFT', 'PUBLISHED', 'PAUSED')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (wallet_id) REFERENCES wallets(id),
  FOREIGN KEY (site_build_id) REFERENCES site_builds(id)
);

CREATE INDEX IF NOT EXISTS idx_storefronts_user
  ON storefronts (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_storefronts_token
  ON storefronts (token_id, updated_at DESC);

PRAGMA optimize;
