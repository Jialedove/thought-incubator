ALTER TABLE thought_nodes ADD COLUMN speech_act TEXT;
ALTER TABLE thought_nodes ADD COLUMN confirmable INTEGER NOT NULL DEFAULT 0;
ALTER TABLE thought_nodes ADD COLUMN provenance_node_id TEXT;

ALTER TABLE conversation_events ADD COLUMN actor TEXT NOT NULL DEFAULT 'system';
ALTER TABLE conversation_events ADD COLUMN speech_act TEXT;
ALTER TABLE conversation_events ADD COLUMN user_action TEXT;
ALTER TABLE conversation_events ADD COLUMN confirmable INTEGER NOT NULL DEFAULT 0;
ALTER TABLE conversation_events ADD COLUMN metadata TEXT NOT NULL DEFAULT '{}';

ALTER TABLE provider_configs ADD COLUMN api_key_last4 TEXT;
ALTER TABLE provider_configs ADD COLUMN headers_ciphertext TEXT;

CREATE TABLE IF NOT EXISTS intervention_runs (
  id TEXT PRIMARY KEY NOT NULL,
  session_id TEXT NOT NULL REFERENCES thought_sessions(id) ON DELETE CASCADE,
  event_id TEXT,
  provider_id TEXT,
  model_id TEXT,
  mode TEXT NOT NULL,
  status TEXT NOT NULL,
  error_message TEXT,
  started_at INTEGER NOT NULL,
  completed_at INTEGER
);

CREATE INDEX IF NOT EXISTS intervention_runs_session_idx ON intervention_runs(session_id);
CREATE INDEX IF NOT EXISTS thought_nodes_focus_idx ON thought_nodes(session_id, updated_at);
CREATE INDEX IF NOT EXISTS provider_configs_enabled_idx ON provider_configs(enabled, is_default);

CREATE TRIGGER IF NOT EXISTS thought_edges_no_self_insert
BEFORE INSERT ON thought_edges
WHEN NEW.source_node_id = NEW.target_node_id
BEGIN
  SELECT RAISE(ABORT, 'thought edges cannot be self loops');
END;

CREATE TRIGGER IF NOT EXISTS thought_edges_no_self_update
BEFORE UPDATE OF source_node_id, target_node_id ON thought_edges
WHEN NEW.source_node_id = NEW.target_node_id
BEGIN
  SELECT RAISE(ABORT, 'thought edges cannot be self loops');
END;
