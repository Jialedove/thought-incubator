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
  sessionId: text("session_id").notNull(),
  type: text("type").notNull(),
  content: text("content").notNull(),
  author: text("author").notNull(),
  epistemicStatus: text("epistemic_status").notNull(),
  parentNodeId: text("parent_node_id"),
  sourceEventIds: text("source_event_ids").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});
export const thoughtEdges = sqliteTable("thought_edges", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  sourceNodeId: text("source_node_id").notNull(),
  targetNodeId: text("target_node_id").notNull(),
  type: text("type").notNull(),
  createdAt: integer("created_at").notNull(),
});
export const conversationEvents = sqliteTable("conversation_events", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  type: text("type").notNull(),
  content: text("content").notNull(),
  cognitiveFunction: text("cognitive_function"),
  nodeIds: text("node_ids").notNull(),
  createdAt: integer("created_at").notNull(),
});
export const providerConfigs = sqliteTable("provider_configs", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  kind: text("kind").notNull(),
  baseUrl: text("base_url"),
  modelId: text("model_id"),
  apiKeyCiphertext: text("api_key_ciphertext"),
  headers: text("headers").notNull(),
  enabled: integer("enabled", { mode: "boolean" }).notNull(),
  isDefault: integer("is_default", { mode: "boolean" }).notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});
export const cognitiveFunctionModels = sqliteTable("cognitive_function_models", {
  id: text("id").primaryKey(),
  cognitiveFunction: text("cognitive_function").notNull().unique(),
  providerId: text("provider_id"),
  modelId: text("model_id"),
  updatedAt: integer("updated_at").notNull(),
});
export const appSettings = sqliteTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: integer("updated_at").notNull(),
});
