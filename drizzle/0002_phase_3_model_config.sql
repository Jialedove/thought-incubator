ALTER TABLE thought_nodes ADD COLUMN candidate_review_status TEXT;

ALTER TABLE provider_configs ADD COLUMN credential_status TEXT NOT NULL DEFAULT 'not_configured';
ALTER TABLE provider_configs ADD COLUMN last_tested_at INTEGER;
ALTER TABLE provider_configs ADD COLUMN last_test_status TEXT;
ALTER TABLE provider_configs ADD COLUMN last_test_error_code TEXT;

CREATE TABLE IF NOT EXISTS model_configs (
  id TEXT PRIMARY KEY NOT NULL,
  provider_id TEXT NOT NULL REFERENCES provider_configs(id) ON DELETE CASCADE,
  model_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  is_default INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'manual',
  capabilities TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

ALTER TABLE cognitive_function_models ADD COLUMN model_config_id TEXT REFERENCES model_configs(id) ON DELETE SET NULL;
ALTER TABLE intervention_runs ADD COLUMN model_config_id TEXT;

UPDATE provider_configs
SET credential_status = CASE WHEN api_key_ciphertext IS NULL THEN 'not_configured' ELSE 'configured' END;

INSERT OR IGNORE INTO model_configs (id, provider_id, model_id, display_name, enabled, is_default, source, capabilities, created_at, updated_at)
SELECT lower(hex(randomblob(16))), id, trim(model_id), trim(model_id), enabled,
  CASE WHEN is_default = 1 AND enabled = 1 AND model_id IS NOT NULL AND trim(model_id) <> '' THEN 1 ELSE 0 END,
  'manual', '{}', created_at, updated_at
FROM provider_configs
WHERE model_id IS NOT NULL AND trim(model_id) <> '';

INSERT OR IGNORE INTO model_configs (id, provider_id, model_id, display_name, enabled, is_default, source, capabilities, created_at, updated_at)
SELECT lower(hex(randomblob(16))), c.provider_id, trim(c.model_id), trim(c.model_id), p.enabled, 0,
  'manual', '{}', c.updated_at, c.updated_at
FROM cognitive_function_models c
JOIN provider_configs p ON p.id = c.provider_id
WHERE c.provider_id IS NOT NULL AND c.model_id IS NOT NULL AND trim(c.model_id) <> ''
  AND NOT EXISTS (SELECT 1 FROM model_configs m WHERE m.provider_id = c.provider_id AND m.model_id = trim(c.model_id));

UPDATE cognitive_function_models
SET model_config_id = (
  SELECT m.id FROM model_configs m
  WHERE m.provider_id = cognitive_function_models.provider_id
    AND m.model_id = trim(cognitive_function_models.model_id)
  LIMIT 1
)
WHERE provider_id IS NOT NULL AND model_id IS NOT NULL;

UPDATE thought_nodes
SET candidate_review_status = CASE WHEN confirmable = 1 THEN 'pending' ELSE NULL END;

WITH first_default AS (
  SELECT m.id FROM model_configs m JOIN provider_configs p ON p.id = m.provider_id
  WHERE m.is_default = 1 AND m.enabled = 1 AND p.enabled = 1
  ORDER BY m.updated_at DESC, m.id
  LIMIT 1
)
UPDATE model_configs SET is_default = CASE WHEN id IN (SELECT id FROM first_default) THEN 1 ELSE 0 END;

CREATE UNIQUE INDEX IF NOT EXISTS model_configs_provider_model_idx ON model_configs(provider_id, model_id);
CREATE UNIQUE INDEX IF NOT EXISTS model_configs_single_default_idx ON model_configs(is_default) WHERE is_default = 1;
CREATE INDEX IF NOT EXISTS model_configs_provider_idx ON model_configs(provider_id, enabled);
