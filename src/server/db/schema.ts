import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const thoughtSessions = sqliteTable("thought_sessions", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  originalIntent: text("original_intent"),
  currentFocusNodeId: text("current_focus_node_id"),
  phase: text("phase").notNull(),
  status: text("status").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});
export const thoughtNodes = sqliteTable("thought_nodes", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull().references(() => thoughtSessions.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  content: text("content").notNull(),
  author: text("author").notNull(),
  epistemicStatus: text("epistemic_status").notNull(),
  parentNodeId: text("parent_node_id"),
  sourceEventIds: text("source_event_ids").notNull(),
  speechAct: text("speech_act"),
  confirmable: integer("confirmable", { mode: "boolean" }).notNull().default(false),
  provenanceNodeId: text("provenance_node_id"),
  candidateReviewStatus: text("candidate_review_status"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});
export const thoughtEdges = sqliteTable("thought_edges", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull().references(() => thoughtSessions.id, { onDelete: "cascade" }),
  sourceNodeId: text("source_node_id").notNull().references(() => thoughtNodes.id, { onDelete: "cascade" }),
  targetNodeId: text("target_node_id").notNull().references(() => thoughtNodes.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  createdAt: integer("created_at").notNull(),
});
export const conversationEvents = sqliteTable("conversation_events", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull().references(() => thoughtSessions.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  actor: text("actor").notNull().default("system"),
  content: text("content").notNull(),
  cognitiveFunction: text("cognitive_function"),
  speechAct: text("speech_act"),
  userAction: text("user_action"),
  confirmable: integer("confirmable", { mode: "boolean" }).notNull().default(false),
  nodeIds: text("node_ids").notNull(),
  metadata: text("metadata").notNull().default("{}"),
  createdAt: integer("created_at").notNull(),
});
export const providerConfigs = sqliteTable("provider_configs", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  kind: text("kind").notNull(),
  baseUrl: text("base_url"),
  modelId: text("model_id"),
  apiKeyCiphertext: text("api_key_ciphertext"),
  apiKeyLast4: text("api_key_last4"),
  headers: text("headers").notNull(),
  headersCiphertext: text("headers_ciphertext"),
  credentialStatus: text("credential_status").notNull().default("not_configured"),
  lastTestedAt: integer("last_tested_at"),
  lastTestStatus: text("last_test_status"),
  lastTestErrorCode: text("last_test_error_code"),
  enabled: integer("enabled", { mode: "boolean" }).notNull(),
  isDefault: integer("is_default", { mode: "boolean" }).notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});
export const modelConfigs = sqliteTable("model_configs", {
  id: text("id").primaryKey(),
  providerId: text("provider_id").notNull().references(() => providerConfigs.id, { onDelete: "cascade" }),
  modelId: text("model_id").notNull(),
  displayName: text("display_name").notNull(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
  source: text("source").notNull().default("manual"),
  capabilities: text("capabilities").notNull().default("{}"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});
export const cognitiveFunctionModels = sqliteTable("cognitive_function_models", {
  id: text("id").primaryKey(),
  cognitiveFunction: text("cognitive_function").notNull().unique(),
  providerId: text("provider_id").references(() => providerConfigs.id, { onDelete: "set null" }),
  modelId: text("model_id"),
  modelConfigId: text("model_config_id").references(() => modelConfigs.id, { onDelete: "set null" }),
  updatedAt: integer("updated_at").notNull(),
});
export const appSettings = sqliteTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: integer("updated_at").notNull(),
});
export const interventionRuns = sqliteTable("intervention_runs", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull().references(() => thoughtSessions.id, { onDelete: "cascade" }),
  eventId: text("event_id"), providerId: text("provider_id"), modelId: text("model_id"), modelConfigId: text("model_config_id"),
  mode: text("mode").notNull(), status: text("status").notNull(), errorMessage: text("error_message"),
  startedAt: integer("started_at").notNull(), completedAt: integer("completed_at"),
});
