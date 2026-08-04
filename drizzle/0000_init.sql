PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS thought_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  original_intent TEXT,
  current_focus_node_id TEXT,
  phase TEXT NOT NULL DEFAULT 'expressing',
  status TEXT NOT NULL DEFAULT 'active',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS thought_nodes (
  id TEXT PRIMARY KEY NOT NULL,
  session_id TEXT NOT NULL REFERENCES thought_sessions(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  content TEXT NOT NULL,
  author TEXT NOT NULL,
  epistemic_status TEXT NOT NULL,
  parent_node_id TEXT,
  source_event_ids TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS thought_edges (
  id TEXT PRIMARY KEY NOT NULL,
  session_id TEXT NOT NULL REFERENCES thought_sessions(id) ON DELETE CASCADE,
  source_node_id TEXT NOT NULL REFERENCES thought_nodes(id) ON DELETE CASCADE,
  target_node_id TEXT NOT NULL REFERENCES thought_nodes(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS conversation_events (
  id TEXT PRIMARY KEY NOT NULL,
  session_id TEXT NOT NULL REFERENCES thought_sessions(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  content TEXT NOT NULL,
  cognitive_function TEXT,
  node_ids TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS provider_configs (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  base_url TEXT,
  model_id TEXT,
  api_key_ciphertext TEXT,
  headers TEXT NOT NULL DEFAULT '{}',
  enabled INTEGER NOT NULL DEFAULT 1,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS cognitive_function_models (
  id TEXT PRIMARY KEY NOT NULL,
  cognitive_function TEXT NOT NULL UNIQUE,
  provider_id TEXT REFERENCES provider_configs(id) ON DELETE SET NULL,
  model_id TEXT,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS thought_nodes_session_idx ON thought_nodes(session_id);
CREATE INDEX IF NOT EXISTS thought_edges_session_idx ON thought_edges(session_id);
CREATE INDEX IF NOT EXISTS conversation_events_session_idx ON conversation_events(session_id);
