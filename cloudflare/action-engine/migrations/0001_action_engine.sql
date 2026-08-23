PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS action_tokens (
  id TEXT PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE,
  actor_id TEXT NOT NULL,
  conversation_id TEXT,
  kind TEXT NOT NULL,
  color TEXT NOT NULL,
  status TEXT NOT NULL,
  token_value INTEGER NOT NULL DEFAULT 1 CHECK (token_value >= 0),
  occurred_at TEXT NOT NULL,
  repository TEXT,
  page_path TEXT,
  input_summary TEXT NOT NULL,
  output_summary TEXT,
  parent_token_ids_json TEXT NOT NULL DEFAULT '[]',
  source_urls_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_action_tokens_conversation
  ON action_tokens (conversation_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_action_tokens_machine
  ON action_tokens (repository, page_path, occurred_at);

CREATE TABLE IF NOT EXISTS page_build_jobs (
  id TEXT PRIMARY KEY,
  action_token_id TEXT NOT NULL,
  machine_id TEXT NOT NULL,
  repository TEXT NOT NULL,
  route TEXT NOT NULL,
  title TEXT NOT NULL,
  purpose TEXT NOT NULL,
  update_mode TEXT NOT NULL CHECK (update_mode IN ('create', 'update')),
  status TEXT NOT NULL CHECK (status IN ('queued', 'building', 'preview-ready', 'blocked', 'published')),
  approval_required INTEGER NOT NULL DEFAULT 1 CHECK (approval_required IN (0, 1)),
  source_token_ids_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (action_token_id) REFERENCES action_tokens(id)
);

CREATE INDEX IF NOT EXISTS idx_page_build_jobs_status
  ON page_build_jobs (status, created_at);
CREATE INDEX IF NOT EXISTS idx_page_build_jobs_machine
  ON page_build_jobs (machine_id, created_at);

CREATE TABLE IF NOT EXISTS build_receipts (
  id TEXT PRIMARY KEY,
  action_token_id TEXT NOT NULL,
  build_job_id TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('preview-ready', 'blocked', 'published')),
  commit_sha TEXT,
  deployment_url TEXT,
  checks_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  FOREIGN KEY (action_token_id) REFERENCES action_tokens(id),
  FOREIGN KEY (build_job_id) REFERENCES page_build_jobs(id),
  CHECK (outcome != 'published' OR commit_sha IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_build_receipts_job
  ON build_receipts (build_job_id, created_at);

