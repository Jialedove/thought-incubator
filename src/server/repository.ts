import { and, desc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { applyDecision, chooseIntervention, classifyUserAction, edgeForUserMove, makeStatePatch, mockIntervention } from "@/domain/protocol";
import { sessionBundleSchema } from "@/domain/schemas";
import type { CognitiveFunction, ConversationEvent, EpistemicStatus, EventActor, InterventionResult, InterventionRun, SessionBundle, SafeProviderConfig, SpeechAct, ThoughtEdge, ThoughtNode, ThoughtSession, UserMove, UserMoveKind } from "@/domain/types";
import { db, ensureDatabase, runTransaction } from "./db";
import { appSettings, conversationEvents, cognitiveFunctionModels, interventionRuns, providerConfigs, thoughtEdges, thoughtNodes, thoughtSessions } from "./db/schema";
import { decryptSecret, encryptSecret, maskHeader, maskSecret } from "./providers/secrets";

const json = (value: unknown) => JSON.stringify(value);
function fromJson<T>(value: string | null | undefined, fallback: T): T {
  try { return value ? JSON.parse(value) as T : fallback; } catch { return fallback; }
}
const now = () => Date.now();

function mapSession(row: typeof thoughtSessions.$inferSelect): ThoughtSession {
  return { ...row, originalIntent: row.originalIntent ?? null, currentFocusNodeId: row.currentFocusNodeId ?? null, phase: row.phase as ThoughtSession["phase"], status: row.status as ThoughtSession["status"] };
}
function mapNode(row: typeof thoughtNodes.$inferSelect): ThoughtNode {
  return {
    ...row, type: row.type as ThoughtNode["type"], author: row.author as ThoughtNode["author"],
    epistemicStatus: row.epistemicStatus as EpistemicStatus, parentNodeId: row.parentNodeId ?? null,
    sourceEventIds: fromJson<string[]>(row.sourceEventIds, []), speechAct: row.speechAct as SpeechAct | null,
    confirmable: Boolean(row.confirmable), provenanceNodeId: row.provenanceNodeId ?? null,
  };
}
function mapEdge(row: typeof thoughtEdges.$inferSelect): ThoughtEdge { return { ...row, type: row.type as ThoughtEdge["type"] }; }
function mapEvent(row: typeof conversationEvents.$inferSelect): ConversationEvent {
  return {
    ...row, type: row.type as ConversationEvent["type"], actor: row.actor as EventActor,
    cognitiveFunction: row.cognitiveFunction as CognitiveFunction | null, speechAct: row.speechAct as SpeechAct | null,
    userAction: row.userAction as UserMoveKind | null, confirmable: Boolean(row.confirmable),
    nodeIds: fromJson<string[]>(row.nodeIds, []), metadata: fromJson<Record<string, string>>(row.metadata, {}),
  };
}
function mapRun(row: typeof interventionRuns.$inferSelect): InterventionRun {
  return { ...row, providerId: row.providerId ?? "", modelId: row.modelId ?? null, mode: row.mode as InterventionRun["mode"], status: row.status as InterventionRun["status"], errorMessage: row.errorMessage ?? null, eventId: row.eventId ?? null, completedAt: row.completedAt ?? null };
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
    runs: db.select().from(interventionRuns).where(eq(interventionRuns.sessionId, id)).orderBy(interventionRuns.startedAt).all().map(mapRun),
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

export function updateSessionStatus(id: string, status: ThoughtSession["status"]) {
  ensureDatabase();
  const result = db.update(thoughtSessions).set({ status, updatedAt: now() }).where(eq(thoughtSessions.id, id)).run();
  if (!result.changes) throw new Error("会话不存在");
  return getSessionBundle(id)?.session ?? null;
}

type PendingTurn = { sessionId: string; bundle: SessionBundle; move: UserMove; decision: ReturnType<typeof chooseIntervention>; userNodeId: string; userEventId: string; previousFocusNodeId: string | null; timestamp: number };

function userNodeType(move: UserMoveKind, first: boolean): ThoughtNode["type"] {
  if (first) return "original_expression";
  if (move === "give_example") return "example";
  if (move === "answer_question") return "answer";
  if (move === "clarify_concept") return "distinction";
  if (move === "revise_view" || move === "partially_accept" || move === "correct_candidate") return "revision";
  if (move === "request_summary") return "temporary_summary";
  return "original_expression";
}

function userSpeechAct(move: UserMoveKind): SpeechAct {
  return move === "request_summary" ? "temporary_summary" : "record";
}

function beginTurn(sessionId: string, text: string, requestedFunction?: CognitiveFunction | null): PendingTurn {
  const bundle = getSessionBundle(sessionId);
  if (!bundle) throw new Error("找不到这个思想会话");
  const move = classifyUserAction(text, bundle);
  const decision = chooseIntervention(bundle, requestedFunction, move);
  const timestamp = now();
  const userNodeId = randomUUID();
  const userEventId = randomUUID();
  const previousFocusNodeId = bundle.session.currentFocusNodeId;
  runTransaction(() => {
    db.insert(conversationEvents).values({
      id: userEventId, sessionId, type: "user_message", actor: "user", content: move.text,
      cognitiveFunction: null, speechAct: userSpeechAct(move.kind), userAction: move.kind,
      confirmable: false, nodeIds: json([userNodeId]), metadata: json({}), createdAt: timestamp,
    }).run();
    db.insert(thoughtNodes).values({
      id: userNodeId, sessionId, type: userNodeType(move.kind, bundle.nodes.length === 0), content: move.text,
      author: "user", epistemicStatus: "user_original", parentNodeId: previousFocusNodeId,
      sourceEventIds: json([userEventId]), speechAct: userSpeechAct(move.kind), confirmable: false,
      provenanceNodeId: null, createdAt: timestamp, updatedAt: timestamp,
    }).run();
    if (previousFocusNodeId && previousFocusNodeId !== userNodeId) {
      db.insert(thoughtEdges).values({ id: randomUUID(), sessionId, sourceNodeId: previousFocusNodeId, targetNodeId: userNodeId, type: edgeForUserMove(move.kind), createdAt: timestamp }).run();
    }
    db.update(thoughtSessions).set({ title: bundle.nodes.length === 0 ? move.text.slice(0, 28) : bundle.session.title, originalIntent: bundle.session.originalIntent ?? move.text, currentFocusNodeId: userNodeId, updatedAt: timestamp }).where(eq(thoughtSessions.id, sessionId)).run();
  });
  return { sessionId, bundle, move, decision, userNodeId, userEventId, previousFocusNodeId, timestamp };
}

function assistantEventType(intervention: InterventionResult): ConversationEvent["type"] {
  if (intervention.confirmable) return "ai_candidate";
  if (intervention.speechAct === "mirror") return "ai_mirror";
  if (intervention.speechAct === "temporary_summary") return "ai_record";
  return "ai_question";
}

function assistantEdgeType(intervention: InterventionResult): ThoughtEdge["type"] {
  return intervention.speechAct === "candidate_claim" ? "clarifies" : intervention.speechAct === "counterexample" ? "challenges" : intervention.speechAct === "distinction" ? "distinguishes" : intervention.speechAct === "connection" ? "extends" : "clarifies";
}

function finalizeTurn(pending: PendingTurn, intervention: InterventionResult, provider: { mode: "mock" | "real"; providerId: string; modelId: string | null }, runId?: string) {
  const assistantEventId = randomUUID();
  const assistantNodeId = intervention.proposedNode ? randomUUID() : null;
  const timestamp = Math.max(now(), pending.timestamp + 1);
  runTransaction(() => {
    if (assistantNodeId && intervention.proposedNode) {
      db.insert(thoughtNodes).values({
        id: assistantNodeId, sessionId: pending.sessionId, type: intervention.proposedNode.type,
        content: intervention.proposedNode.content, author: "system", epistemicStatus: intervention.proposedNode.epistemicStatus,
        parentNodeId: pending.userNodeId, sourceEventIds: json([assistantEventId]), speechAct: intervention.speechAct,
        confirmable: intervention.confirmable, provenanceNodeId: null, createdAt: timestamp, updatedAt: timestamp,
      }).run();
      db.insert(thoughtEdges).values({ id: randomUUID(), sessionId: pending.sessionId, sourceNodeId: pending.userNodeId, targetNodeId: assistantNodeId, type: assistantEdgeType(intervention), createdAt: timestamp }).run();
    }
    db.insert(conversationEvents).values({
      id: assistantEventId, sessionId: pending.sessionId, type: assistantEventType(intervention), actor: "assistant",
      content: intervention.message, cognitiveFunction: intervention.cognitiveFunction, speechAct: intervention.speechAct,
      userAction: null, confirmable: intervention.confirmable, nodeIds: json(assistantNodeId ? [assistantNodeId] : []),
      metadata: json({ mode: provider.mode, providerId: provider.providerId, modelId: provider.modelId ?? "" }), createdAt: timestamp,
    }).run();
    if (runId) db.update(interventionRuns).set({ eventId: assistantEventId, status: "completed", completedAt: timestamp }).where(eq(interventionRuns.id, runId)).run();
    else db.insert(interventionRuns).values({ id: randomUUID(), sessionId: pending.sessionId, eventId: assistantEventId, providerId: provider.providerId, modelId: provider.modelId, mode: provider.mode, status: "completed", errorMessage: null, startedAt: pending.timestamp, completedAt: timestamp }).run();
    db.update(thoughtSessions).set({ currentFocusNodeId: assistantNodeId ?? pending.userNodeId, phase: intervention.suggestedPhase, updatedAt: timestamp }).where(eq(thoughtSessions.id, pending.sessionId)).run();
  });
  const updated = getSessionBundle(pending.sessionId);
  if (!updated) throw new Error("保存后无法读取思想会话");
  return { bundle: updated, action: pending.move, decision: pending.decision, patch: makeStatePatch(pending.userNodeId, assistantNodeId, intervention.suggestedPhase, assistantEdgeType(intervention)), assistantNodeId, mode: provider.mode, providerId: provider.providerId, modelId: provider.modelId };
}

export function appendTurn(sessionId: string, text: string, requestedFunction?: CognitiveFunction | null) {
  const pending = beginTurn(sessionId, text, requestedFunction);
  return finalizeTurn(pending, mockIntervention(pending.decision.cognitiveFunction, text), { mode: "mock", providerId: "mock", modelId: "demo" });
}

export async function streamTurn(sessionId: string, text: string, requestedFunction: CognitiveFunction | null | undefined, callbacks: { onStart?: (value: { mode: "mock" | "real"; providerId: string; modelId: string | null }) => void; onDelta?: (value: string) => void }, abortSignal?: AbortSignal) {
  const pending = beginTurn(sessionId, text, requestedFunction);
  const { getProviderForFunction, streamIntervention } = await import("./providers/registry");
  const provider = getProviderForFunction(pending.decision.cognitiveFunction);
  const runtime = { mode: provider.kind === "mock" ? "mock" as const : "real" as const, providerId: provider.id, modelId: provider.modelId };
  const runId = randomUUID();
  db.insert(interventionRuns).values({ id: runId, sessionId, eventId: null, providerId: runtime.providerId, modelId: runtime.modelId, mode: runtime.mode, status: "running", errorMessage: null, startedAt: pending.timestamp, completedAt: null }).run();
  callbacks.onStart?.(runtime);
  try {
    if (runtime.mode === "mock") {
      const mock = mockIntervention(pending.decision.cognitiveFunction, text);
      for (const chunk of mock.message.match(/.{1,12}/gu) ?? [mock.message]) {
        if (abortSignal?.aborted) throw new DOMException("生成已停止", "AbortError");
        callbacks.onDelta?.(chunk);
        await Promise.resolve();
      }
      return finalizeTurn(pending, mock, runtime, runId);
    }
    const intervention = await streamIntervention(provider, pending.decision, pending.move.text, callbacks.onDelta, abortSignal);
    return finalizeTurn(pending, intervention, runtime, runId);
  } catch (error) {
    db.update(interventionRuns).set({ status: abortSignal?.aborted ? "aborted" : "failed", errorMessage: error instanceof Error ? error.message.slice(0, 500) : "模型请求失败", completedAt: now() }).where(eq(interventionRuns.id, runId)).run();
    throw error;
  }
}

function maskedHeaders(row: typeof providerConfigs.$inferSelect) {
  const stored = fromJson<Record<string, string>>(row.headers, {});
  return Object.fromEntries(Object.keys(stored).map((key) => [key, stored[key].startsWith("••••") || stored[key] === "已设置" ? stored[key] : maskHeader(stored[key])]));
}

function safeProvider(row: typeof providerConfigs.$inferSelect): SafeProviderConfig {
  return {
    id: row.id, name: row.name, kind: row.kind as SafeProviderConfig["kind"], baseUrl: row.baseUrl ?? null,
    modelId: row.modelId ?? null, enabled: row.enabled, isDefault: row.isDefault,
    apiKeyMasked: row.apiKeyCiphertext ? (row.apiKeyLast4 ? "••••••••" + row.apiKeyLast4 : "已设置") : "未设置",
    headers: maskedHeaders(row), createdAt: row.createdAt, updatedAt: row.updatedAt,
  };
}

export function listProviders(): SafeProviderConfig[] {
  ensureDatabase();
  return db.select().from(providerConfigs).orderBy(desc(providerConfigs.updatedAt)).all().map(safeProvider);
}

type ProviderInput = { id?: string; name: string; kind: SafeProviderConfig["kind"]; baseUrl?: string | null; apiKey?: string; modelId?: string | null; headers: Record<string, string>; enabled: boolean; isDefault: boolean };
export function saveProvider(input: ProviderInput) {
  ensureDatabase();
  const timestamp = now();
  const existing = input.id ? db.select().from(providerConfigs).where(eq(providerConfigs.id, input.id)).get() : undefined;
  if (input.id && !existing) throw new Error("供应商不存在");
  const id = input.id ?? randomUUID();
  const ciphertext = input.apiKey?.trim() ? encryptSecret(input.apiKey.trim()) : existing?.apiKeyCiphertext ?? null;
  const apiKeyLast4 = input.apiKey?.trim() ? input.apiKey.trim().slice(-4) : existing?.apiKeyLast4 ?? null;
  const oldHeaders = existing?.headersCiphertext ? fromJson<Record<string, string>>(decryptSecret(existing.headersCiphertext), {}) : fromJson<Record<string, string>>(existing?.headers, {});
  const headerValues = Object.fromEntries(Object.entries(input.headers).map(([key, value]) => [key, value.startsWith("••••") || value === "已设置" ? oldHeaders[key] ?? "" : value]).filter(([, value]) => Boolean(value)));
  const headersCiphertext = Object.keys(headerValues).length ? encryptSecret(json(headerValues)) : null;
  const publicHeaders = Object.fromEntries(Object.entries(input.headers).map(([key, value]) => [key, value.startsWith("••••") || value === "已设置" ? value : maskHeader(value)]));
  runTransaction(() => {
    if (input.isDefault) db.update(providerConfigs).set({ isDefault: false, updatedAt: timestamp }).run();
    const values = { name: input.name, kind: input.kind, baseUrl: input.baseUrl ?? null, modelId: input.modelId ?? null, apiKeyCiphertext: ciphertext, apiKeyLast4, headers: json(publicHeaders), headersCiphertext, enabled: input.enabled, isDefault: input.isDefault, updatedAt: timestamp };
    if (existing) db.update(providerConfigs).set(values).where(eq(providerConfigs.id, id)).run();
    else db.insert(providerConfigs).values({ id, ...values, createdAt: timestamp }).run();
  });
  const row = db.select().from(providerConfigs).where(eq(providerConfigs.id, id)).get();
  if (!row) throw new Error("供应商保存失败");
  return safeProvider(row);
}

export function removeProvider(id: string) {
  ensureDatabase();
  db.delete(providerConfigs).where(eq(providerConfigs.id, id)).run();
}

export type RuntimeProvider = SafeProviderConfig & { apiKey: string; headers: Record<string, string> };
export function getProviderSecret(id: string): RuntimeProvider | null {
  ensureDatabase();
  const row = db.select().from(providerConfigs).where(and(eq(providerConfigs.id, id), eq(providerConfigs.enabled, true))).get();
  if (!row) return null;
  const headers = row.headersCiphertext ? fromJson<Record<string, string>>(decryptSecret(row.headersCiphertext), {}) : fromJson<Record<string, string>>(row.headers, {});
  return { ...safeProvider(row), apiKey: row.apiKeyCiphertext ? decryptSecret(row.apiKeyCiphertext) : "", headers };
}

export function getProviderForFunction(cognitiveFunction: CognitiveFunction): RuntimeProvider {
  ensureDatabase();
  const mapping = db.select().from(cognitiveFunctionModels).where(eq(cognitiveFunctionModels.cognitiveFunction, cognitiveFunction)).get();
  const selected = mapping?.providerId ? getProviderSecret(mapping.providerId) : null;
  const fallback = selected ?? db.select().from(providerConfigs).where(and(eq(providerConfigs.enabled, true), eq(providerConfigs.isDefault, true))).get();
  const provider = fallback && "apiKeyCiphertext" in fallback ? getProviderSecret(fallback.id) : null;
  if (!provider || (provider.kind !== "mock" && (!provider.apiKey || !provider.modelId))) return { id: "mock", name: "本地模拟模型", kind: "mock", baseUrl: null, modelId: "demo", enabled: true, isDefault: true, apiKeyMasked: "未设置", headers: {}, createdAt: 0, updatedAt: 0, apiKey: "" };
  if (mapping?.modelId) provider.modelId = mapping.modelId;
  return provider;
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
export function saveFunctionModels(models: Array<{ cognitiveFunction: string; providerId: string | null; modelId: string | null }>) {
  ensureDatabase();
  runTransaction(() => {
    for (const model of models) db.insert(cognitiveFunctionModels).values({ id: randomUUID(), cognitiveFunction: model.cognitiveFunction, providerId: model.providerId, modelId: model.modelId, updatedAt: now() }).onConflictDoUpdate({ target: cognitiveFunctionModels.cognitiveFunction, set: { providerId: model.providerId, modelId: model.modelId, updatedAt: now() } }).run();
  });
  return listFunctionModels();
}
export function saveFunctionModel(cognitiveFunction: string, providerId: string | null, modelId: string | null) { return saveFunctionModels([{ cognitiveFunction, providerId, modelId }]); }

export function decideNode(sessionId: string, nodeId: string, action: "accept" | "partial" | "misunderstood" | "candidate" | "reject", note?: string, content?: string) {
  ensureDatabase();
  const row = db.select().from(thoughtNodes).where(and(eq(thoughtNodes.id, nodeId), eq(thoughtNodes.sessionId, sessionId))).get();
  if (!row) throw new Error("找不到这个思想节点，或它不属于当前会话");
  const node = mapNode(row);
  if (!node.confirmable || node.epistemicStatus !== "ai_proposal") throw new Error("只有待确认的 AI 候选表达可以执行此操作");
  if ((action === "partial" || action === "misunderstood") && !note?.trim()) throw new Error("部分接受或纠正时，请补充你的说明");
  const timestamp = now();
  const eventId = randomUUID();
  const decisionResult = applyDecision(node.epistemicStatus, action);
  const createsUserNode = action === "accept" || action === "partial" || action === "misunderstood" || (action === "reject" && Boolean(note?.trim()));
  const userNodeId = createsUserNode ? randomUUID() : null;
  const eventType = action === "accept" ? "user_confirmation" : action === "reject" ? "user_rejection" : action === "candidate" ? "node_status_changed" : "user_correction";
  const nodeContent = action === "accept" ? content?.trim() || node.content : content?.trim() || note?.trim() || node.content;
  runTransaction(() => {
    if (userNodeId) {
      const type = action === "accept" ? "accepted_claim" : action === "reject" ? "revision" : "revision";
      db.insert(thoughtNodes).values({ id: userNodeId, sessionId, type, content: nodeContent, author: "user", epistemicStatus: action === "accept" ? "user_accepted" : action === "reject" ? "user_rejected" : decisionResult.epistemicStatus, parentNodeId: node.id, sourceEventIds: json([eventId]), speechAct: action === "accept" ? "candidate_claim" : "record", confirmable: false, provenanceNodeId: node.id, createdAt: timestamp, updatedAt: timestamp }).run();
      const edgeType = action === "accept" ? "accepted_by_user" : action === "partial" ? "partially_accepts" : action === "misunderstood" || action === "reject" ? "corrects" : "responds_to";
      if (node.id !== userNodeId) db.insert(thoughtEdges).values({ id: randomUUID(), sessionId, sourceNodeId: node.id, targetNodeId: userNodeId, type: edgeType, createdAt: timestamp }).run();
    }
    db.insert(conversationEvents).values({ id: eventId, sessionId, type: eventType, actor: "user", content: note?.trim() || action, cognitiveFunction: null, speechAct: action === "accept" ? "candidate_claim" : "record", userAction: action === "accept" ? "accept_candidate" : action === "partial" ? "partially_accept" : action === "misunderstood" ? "correct_candidate" : action === "reject" ? "reject_interpretation" : null, confirmable: false, nodeIds: json([node.id, ...(userNodeId ? [userNodeId] : [])]), metadata: json({ action, candidateNodeId: node.id }), createdAt: timestamp }).run();
    db.update(thoughtSessions).set({ currentFocusNodeId: userNodeId ?? node.id, updatedAt: timestamp }).where(eq(thoughtSessions.id, sessionId)).run();
  });
  return getSessionBundle(sessionId);
}

export function exportBundle(id: string) { return getSessionBundle(id); }

export function focusNode(sessionId: string, nodeId: string) {
  ensureDatabase();
  const node = db.select({ id: thoughtNodes.id }).from(thoughtNodes).where(and(eq(thoughtNodes.id, nodeId), eq(thoughtNodes.sessionId, sessionId))).get();
  if (!node) throw new Error("节点不属于当前会话");
  db.update(thoughtSessions).set({ currentFocusNodeId: nodeId, updatedAt: now() }).where(eq(thoughtSessions.id, sessionId)).run();
  return getSessionBundle(sessionId);
}

export function importBundle(input: unknown) {
  ensureDatabase();
  const parsed = sessionBundleSchema.parse(input);
  const source = parsed.session;
  const sessionId = db.select({ id: thoughtSessions.id }).from(thoughtSessions).where(eq(thoughtSessions.id, source.id)).get() ? randomUUID() : source.id;
  const nodeIds = new Map(parsed.nodes.map((node) => [node.id, db.select({ id: thoughtNodes.id }).from(thoughtNodes).where(eq(thoughtNodes.id, node.id)).get() ? randomUUID() : node.id]));
  const eventIds = new Map(parsed.events.map((event) => [event.id, db.select({ id: conversationEvents.id }).from(conversationEvents).where(eq(conversationEvents.id, event.id)).get() ? randomUUID() : event.id]));
  const rewriteNode = (id: string | null) => id ? nodeIds.get(id) ?? null : null;
  runTransaction(() => {
    db.insert(thoughtSessions).values({ ...source, id: sessionId, currentFocusNodeId: rewriteNode(source.currentFocusNodeId) }).run();
    for (const node of parsed.nodes) db.insert(thoughtNodes).values({ ...node, id: nodeIds.get(node.id)!, sessionId, parentNodeId: rewriteNode(node.parentNodeId), sourceEventIds: json(node.sourceEventIds.map((id) => eventIds.get(id) ?? id)), provenanceNodeId: rewriteNode(node.provenanceNodeId) }).run();
    for (const event of parsed.events) db.insert(conversationEvents).values({ ...event, id: eventIds.get(event.id)!, sessionId, nodeIds: json(event.nodeIds.map((id) => nodeIds.get(id) ?? id)), metadata: json(event.metadata) }).run();
    for (const edge of parsed.edges) {
      const sourceId = rewriteNode(edge.sourceNodeId);
      const targetId = rewriteNode(edge.targetNodeId);
      if (sourceId && targetId && sourceId !== targetId) db.insert(thoughtEdges).values({ ...edge, id: db.select({ id: thoughtEdges.id }).from(thoughtEdges).where(eq(thoughtEdges.id, edge.id)).get() ? randomUUID() : edge.id, sessionId, sourceNodeId: sourceId, targetNodeId: targetId }).run();
    }
    for (const run of parsed.runs ?? []) db.insert(interventionRuns).values({ ...run, id: db.select({ id: interventionRuns.id }).from(interventionRuns).where(eq(interventionRuns.id, run.id)).get() ? randomUUID() : run.id, sessionId, eventId: run.eventId ? eventIds.get(run.eventId) ?? null : null }).run();
  });
  return getSessionBundle(sessionId);
}
