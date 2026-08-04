import { and, desc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { applyDecision, chooseIntervention, classifyUserAction, makeStatePatch, mockIntervention } from "@/domain/protocol";
import type { CognitiveFunction, ConversationEvent, EpistemicStatus, SessionBundle, SafeProviderConfig, ThoughtEdge, ThoughtNode, ThoughtSession } from "@/domain/types";
import { db, ensureDatabase, runTransaction } from "./db";
import { appSettings, conversationEvents, cognitiveFunctionModels, providerConfigs, thoughtEdges, thoughtNodes, thoughtSessions } from "./db/schema";
import { decryptSecret, encryptSecret, maskSecret } from "./providers/secrets";

const json = (value: unknown) => JSON.stringify(value);
const fromJson = <T>(value: string): T => JSON.parse(value) as T;
const now = () => Date.now();

function mapSession(row: typeof thoughtSessions.$inferSelect): ThoughtSession {
  return { ...row, originalIntent: row.originalIntent ?? null, currentFocusNodeId: row.currentFocusNodeId ?? null, phase: row.phase as ThoughtSession["phase"], status: row.status as ThoughtSession["status"] };
}
function mapNode(row: typeof thoughtNodes.$inferSelect): ThoughtNode {
  return { ...row, type: row.type as ThoughtNode["type"], author: row.author as ThoughtNode["author"], epistemicStatus: row.epistemicStatus as EpistemicStatus, parentNodeId: row.parentNodeId ?? null, sourceEventIds: fromJson<string[]>(row.sourceEventIds) };
}
function mapEdge(row: typeof thoughtEdges.$inferSelect): ThoughtEdge {
  return { ...row, type: row.type as ThoughtEdge["type"] };
}
function mapEvent(row: typeof conversationEvents.$inferSelect): ConversationEvent {
  return { ...row, type: row.type as ConversationEvent["type"], cognitiveFunction: row.cognitiveFunction as CognitiveFunction | null, nodeIds: fromJson<string[]>(row.nodeIds) };
}

export function listSessions(): ThoughtSession[] {
  ensureDatabase();
  return db.select().from(thoughtSessions).orderBy(desc(thoughtSessions.updatedAt)).all().map(mapSession);
}

export function getSessionBundle(id: string): SessionBundle | null {
  ensureDatabase();
  const session = db.select().from(thoughtSessions).where(eq(thoughtSessions.id, id)).get();
  if (!session) return null;
  return {
    session: mapSession(session),
    nodes: db.select().from(thoughtNodes).where(eq(thoughtNodes.sessionId, id)).orderBy(thoughtNodes.createdAt).all().map(mapNode),
    edges: db.select().from(thoughtEdges).where(eq(thoughtEdges.sessionId, id)).orderBy(thoughtEdges.createdAt).all().map(mapEdge),
    events: db.select().from(conversationEvents).where(eq(conversationEvents.sessionId, id)).orderBy(conversationEvents.createdAt).all().map(mapEvent),
  };
}

export function createSession(title = "未命名思想"): ThoughtSession {
  ensureDatabase();
  const timestamp = now();
  const session = { id: randomUUID(), title, originalIntent: null, currentFocusNodeId: null, phase: "expressing", status: "active", createdAt: timestamp, updatedAt: timestamp } as const;
  db.insert(thoughtSessions).values(session).run();
  return mapSession(session);
}

export function deleteSession(id: string) {
  ensureDatabase();
  db.delete(thoughtSessions).where(eq(thoughtSessions.id, id)).run();
}

export function appendTurn(sessionId: string, text: string, requestedFunction?: CognitiveFunction | null) {
  const bundle = getSessionBundle(sessionId);
  if (!bundle) throw new Error("找不到这个思想会话");
  const action = classifyUserAction(text);
  const decision = chooseIntervention(bundle, requestedFunction);
  const intervention = mockIntervention(decision.cognitiveFunction, text);
  const timestamp = now();
  const userNodeId = randomUUID();
  const userEventId = randomUUID();
  const assistantNodeId = randomUUID();
  const assistantEventId = randomUUID();
  runTransaction(() => {
    db.insert(conversationEvents).values({ id: userEventId, sessionId, type: "user_message", content: text, cognitiveFunction: null, nodeIds: json([userNodeId]), createdAt: timestamp }).run();
    db.insert(thoughtNodes).values({ id: userNodeId, sessionId, type: bundle.nodes.length === 0 ? "original_expression" : "revision", content: text, author: "user", epistemicStatus: "user_original", parentNodeId: bundle.session.currentFocusNodeId, sourceEventIds: json([userEventId]), createdAt: timestamp, updatedAt: timestamp }).run();
    db.insert(conversationEvents).values({ id: assistantEventId, sessionId, type: decision.cognitiveFunction === "reformulate" ? "ai_candidate" : "ai_question", content: intervention.content, cognitiveFunction: decision.cognitiveFunction, nodeIds: json([assistantNodeId]), createdAt: timestamp + 1 }).run();
    db.insert(thoughtNodes).values({ id: assistantNodeId, sessionId, type: intervention.nodeType, content: intervention.content, author: "system", epistemicStatus: intervention.epistemicStatus, parentNodeId: userNodeId, sourceEventIds: json([assistantEventId]), createdAt: timestamp + 1, updatedAt: timestamp + 1 }).run();
    db.insert(thoughtEdges).values({ id: randomUUID(), sessionId, sourceNodeId: userNodeId, targetNodeId: assistantNodeId, type: decision.cognitiveFunction === "challenge" ? "challenges" : "clarifies", createdAt: timestamp + 1 }).run();
    db.update(thoughtSessions).set({ title: bundle.nodes.length === 0 ? text.slice(0, 28) : bundle.session.title, originalIntent: bundle.session.originalIntent ?? text, currentFocusNodeId: assistantNodeId, phase: intervention.phase, updatedAt: timestamp + 1 }).where(eq(thoughtSessions.id, sessionId)).run();
  });
  const updated = getSessionBundle(sessionId);
  if (!updated) throw new Error("保存后无法读取思想会话");
  return { bundle: updated, action, decision, patch: makeStatePatch(userNodeId, assistantNodeId, intervention.phase), assistantNodeId };
}

export function decideNode(nodeId: string, action: "accept" | "partial" | "misunderstood" | "candidate" | "reject", note?: string) {
  ensureDatabase();
  const node = db.select().from(thoughtNodes).where(eq(thoughtNodes.id, nodeId)).get();
  if (!node) throw new Error("找不到这个思想节点");
  const result = applyDecision(node.epistemicStatus as EpistemicStatus, action);
  const timestamp = now();
  const eventType = action === "accept" ? "user_confirmation" : action === "partial" || action === "misunderstood" ? "user_correction" : action === "reject" ? "user_rejection" : "node_status_changed";
  const eventId = randomUUID();
  runTransaction(() => {
    db.update(thoughtNodes).set({ epistemicStatus: result.epistemicStatus, type: result.nodeType, updatedAt: timestamp }).where(eq(thoughtNodes.id, nodeId)).run();
    db.insert(conversationEvents).values({ id: eventId, sessionId: node.sessionId, type: eventType, content: note ?? action, cognitiveFunction: null, nodeIds: json([nodeId]), createdAt: timestamp }).run();
    if (action === "accept" || action === "reject") db.insert(thoughtEdges).values({ id: randomUUID(), sessionId: node.sessionId, sourceNodeId: nodeId, targetNodeId: nodeId, type: action === "accept" ? "accepted_by_user" : "rejected_by_user", createdAt: timestamp }).run();
    db.update(thoughtSessions).set({ updatedAt: timestamp }).where(eq(thoughtSessions.id, node.sessionId)).run();
  });
  return getSessionBundle(node.sessionId);
}

export function exportBundle(id: string) {
  return getSessionBundle(id);
}

function safeProvider(row: typeof providerConfigs.$inferSelect): SafeProviderConfig {
  return {
    id: row.id, name: row.name, kind: row.kind as SafeProviderConfig["kind"], baseUrl: row.baseUrl ?? null,
    modelId: row.modelId ?? null, enabled: row.enabled, isDefault: row.isDefault,
    apiKeyMasked: row.apiKeyCiphertext ? maskSecret(decryptSecret(row.apiKeyCiphertext)) : "未设置",
    headers: fromJson<Record<string, string>>(row.headers), createdAt: row.createdAt, updatedAt: row.updatedAt,
  };
}

export function listProviders(): SafeProviderConfig[] {
  ensureDatabase();
  return db.select().from(providerConfigs).orderBy(desc(providerConfigs.updatedAt)).all().map(safeProvider);
}

export function saveProvider(input: { id?: string; name: string; kind: SafeProviderConfig["kind"]; baseUrl?: string | null; apiKey?: string; modelId?: string | null; headers: Record<string, string>; enabled: boolean; isDefault: boolean }) {
  ensureDatabase();
  const timestamp = now();
  const existing = input.id ? db.select().from(providerConfigs).where(eq(providerConfigs.id, input.id)).get() : undefined;
  const id = input.id ?? randomUUID();
  const ciphertext = input.apiKey ? encryptSecret(input.apiKey) : existing?.apiKeyCiphertext ?? null;
  runTransaction(() => {
    if (input.isDefault) db.update(providerConfigs).set({ isDefault: false, updatedAt: timestamp }).run();
    if (existing) {
      db.update(providerConfigs).set({ name: input.name, kind: input.kind, baseUrl: input.baseUrl ?? null, modelId: input.modelId ?? null, apiKeyCiphertext: ciphertext, headers: json(input.headers), enabled: input.enabled, isDefault: input.isDefault, updatedAt: timestamp }).where(eq(providerConfigs.id, id)).run();
    } else {
      db.insert(providerConfigs).values({ id, name: input.name, kind: input.kind, baseUrl: input.baseUrl ?? null, modelId: input.modelId ?? null, apiKeyCiphertext: ciphertext, headers: json(input.headers), enabled: input.enabled, isDefault: input.isDefault, createdAt: timestamp, updatedAt: timestamp }).run();
    }
  });
  const row = db.select().from(providerConfigs).where(eq(providerConfigs.id, id)).get();
  if (!row) throw new Error("供应商保存失败");
  return safeProvider(row);
}

export function removeProvider(id: string) {
  ensureDatabase();
  db.delete(providerConfigs).where(eq(providerConfigs.id, id)).run();
}

export function getProviderSecret(id: string) {
  ensureDatabase();
  const row = db.select().from(providerConfigs).where(and(eq(providerConfigs.id, id), eq(providerConfigs.enabled, true))).get();
  if (!row) return null;
  return { ...safeProvider(row), apiKey: row.apiKeyCiphertext ? decryptSecret(row.apiKeyCiphertext) : "" };
}

export function setSetting(key: string, value: string) {
  ensureDatabase();
  db.insert(appSettings).values({ key, value, updatedAt: now() }).onConflictDoUpdate({ target: appSettings.key, set: { value, updatedAt: now() } }).run();
}

export function getSettings() {
  ensureDatabase();
  return Object.fromEntries(db.select().from(appSettings).all().map((row) => [row.key, row.value]));
}

export function listFunctionModels() {
  ensureDatabase();
  return db.select().from(cognitiveFunctionModels).all();
}

export function saveFunctionModel(cognitiveFunction: string, providerId: string | null, modelId: string | null) {
  ensureDatabase();
  db.insert(cognitiveFunctionModels).values({ id: randomUUID(), cognitiveFunction, providerId, modelId, updatedAt: now() }).onConflictDoUpdate({ target: cognitiveFunctionModels.cognitiveFunction, set: { providerId, modelId, updatedAt: now() } }).run();
  return listFunctionModels();
}
