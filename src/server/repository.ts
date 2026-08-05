import { and, desc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { applyDecision, chooseIntervention, classifyUserAction, edgeForUserMove, makeStatePatch, mockIntervention } from "@/domain/protocol";
import { sessionBundleSchema } from "@/domain/schemas";
import type { CandidateReviewStatus, CognitiveFunction, ConversationEvent, EpistemicStatus, EventActor, InterventionResult, InterventionRun, ModelConfig, ProviderErrorCode, SessionBundle, SafeProviderConfig, SpeechAct, ThoughtEdge, ThoughtNode, ThoughtSession, UserMove, UserMoveKind } from "@/domain/types";
import { db, ensureDatabase, runTransaction } from "./db";
import { appSettings, conversationEvents, cognitiveFunctionModels, interventionRuns, modelConfigs, providerConfigs, thoughtEdges, thoughtNodes, thoughtSessions } from "./db/schema";
import { decryptSecret, encryptSecret, maskHeader, maskSecret } from "./providers/secrets";
import { buildThoughtContext } from "./context/build-thought-context";
import { ProviderError } from "./errors";

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
    confirmable: Boolean(row.confirmable), candidateReviewStatus: row.candidateReviewStatus as CandidateReviewStatus | null, provenanceNodeId: row.provenanceNodeId ?? null,
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
  return { ...row, providerId: row.providerId ?? "", modelId: row.modelId ?? null, modelConfigId: row.modelConfigId ?? null, mode: row.mode as InterventionRun["mode"], status: row.status as InterventionRun["status"], errorMessage: row.errorMessage ?? null, eventId: row.eventId ?? null, completedAt: row.completedAt ?? null };
}
function mapModel(row: typeof modelConfigs.$inferSelect): ModelConfig {
  return { ...row, source: row.source as ModelConfig["source"], capabilities: fromJson<Record<string, boolean>>(row.capabilities, {}) };
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

function beginTurn(sessionId: string, text: string, requestedFunction?: CognitiveFunction | null, clientRequestId?: string) {
  const bundle = getSessionBundle(sessionId);
  if (!bundle) throw new Error("找不到这个思想会话");
  const move = classifyUserAction(text, bundle);
  const decision = chooseIntervention(bundle, requestedFunction, move);
  const timestamp = now();
  const currentFocus = bundle.session.currentFocusNodeId ? bundle.nodes.find((node) => node.id === bundle.session.currentFocusNodeId) : undefined;
  const idempotentEvent = clientRequestId ? bundle.events.find((event) => event.actor === "user" && event.metadata.clientRequestId === clientRequestId) : undefined;
  const idempotentNode = idempotentEvent ? bundle.nodes.find((node) => idempotentEvent.nodeIds.includes(node.id)) : undefined;
  if (idempotentEvent && idempotentNode) {
    return { sessionId, bundle, move, decision, userNodeId: idempotentNode.id, userEventId: idempotentEvent.id, previousFocusNodeId: idempotentNode.parentNodeId, timestamp };
  }
  if (currentFocus?.author === "user" && currentFocus.content === move.text && currentFocus.sourceEventIds[0]) {
    return { sessionId, bundle, move, decision, userNodeId: currentFocus.id, userEventId: currentFocus.sourceEventIds[0], previousFocusNodeId: currentFocus.parentNodeId, timestamp };
  }
  const userNodeId = randomUUID();
  const userEventId = randomUUID();
  const previousFocusNodeId = bundle.session.currentFocusNodeId;
  runTransaction(() => {
    db.insert(conversationEvents).values({
      id: userEventId, sessionId, type: "user_message", actor: "user", content: move.text,
      cognitiveFunction: null, speechAct: userSpeechAct(move.kind), userAction: move.kind,
      confirmable: false, nodeIds: json([userNodeId]), metadata: json(clientRequestId ? { clientRequestId } : {}), createdAt: timestamp,
    }).run();
    db.insert(thoughtNodes).values({
      id: userNodeId, sessionId, type: userNodeType(move.kind, bundle.nodes.length === 0), content: move.text,
      author: "user", epistemicStatus: "user_original", parentNodeId: previousFocusNodeId,
      sourceEventIds: json([userEventId]), speechAct: userSpeechAct(move.kind), confirmable: false, candidateReviewStatus: null,
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

function finalizeTurn(pending: PendingTurn, intervention: InterventionResult, provider: { mode: "mock" | "real"; providerId: string; modelId: string | null; modelConfigId?: string | null }, runId?: string) {
  const assistantEventId = randomUUID();
  const assistantNodeId = intervention.proposedNode ? randomUUID() : null;
  const timestamp = Math.max(now(), pending.timestamp + 1);
  runTransaction(() => {
    if (assistantNodeId && intervention.proposedNode) {
      db.insert(thoughtNodes).values({
        id: assistantNodeId, sessionId: pending.sessionId, type: intervention.proposedNode.type,
        content: intervention.proposedNode.content, author: "system", epistemicStatus: intervention.proposedNode.epistemicStatus,
        parentNodeId: pending.userNodeId, sourceEventIds: json([assistantEventId]), speechAct: intervention.speechAct,
        confirmable: intervention.confirmable, candidateReviewStatus: intervention.confirmable ? "pending" : null, provenanceNodeId: null, createdAt: timestamp, updatedAt: timestamp,
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
    else db.insert(interventionRuns).values({ id: randomUUID(), sessionId: pending.sessionId, eventId: assistantEventId, providerId: provider.providerId, modelId: provider.modelId, modelConfigId: provider.modelConfigId ?? null, mode: provider.mode, status: "completed", errorMessage: null, startedAt: pending.timestamp, completedAt: timestamp }).run();
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

function decisionActionForMove(move: UserMove): "accept" | "partial" | "misunderstood" | "reject" | null {
  return move.kind === "accept_candidate" ? "accept" : move.kind === "partially_accept" ? "partial" : move.kind === "correct_candidate" ? "misunderstood" : move.kind === "reject_interpretation" ? "reject" : null;
}

function prepareStreamTurn(sessionId: string, text: string, requestedFunction: CognitiveFunction | null | undefined, mode: "auto" | "mock" | "real") {
  const before = getSessionBundle(sessionId);
  if (!before) throw new Error("找不到这个思想会话");
  const move = classifyUserAction(text, before);
  const decision = chooseIntervention(before, requestedFunction, move);
  const decisionAction = decisionActionForMove(move);
  if (decisionAction) {
    const candidates = before.nodes.filter((node) => node.confirmable && node.epistemicStatus === "ai_proposal" && node.candidateReviewStatus === "pending");
    if (candidates.length !== 1) throw new ProviderError("CANDIDATE_AMBIGUOUS", candidates.length ? "请先指定要处理的候选表达" : "当前没有待确认的候选表达");
    return { before, move, decision, decisionAction, resolved: null };
  }
  const resolved = resolveModelForFunction(decision.cognitiveFunction, mode);
  if (!resolved.readiness.ok || !resolved.modelConfig) throw new ProviderError((resolved.readiness.code ?? "CONNECTION_FAILED") as ProviderErrorCode, resolved.readiness.message, { type: "open-model-settings", targetId: resolved.provider?.id });
  return { before, move, decision, decisionAction: null, resolved };
}

export function previewStreamTurn(sessionId: string, text: string, requestedFunction: CognitiveFunction | null | undefined, mode: "auto" | "mock" | "real" = "auto") {
  const prepared = prepareStreamTurn(sessionId, text, requestedFunction, mode);
  return prepared.resolved ? { ok: true, mode: prepared.resolved.mode, provider: prepared.resolved.provider, modelConfig: prepared.resolved.modelConfig } : { ok: true, mode: "mock" as const, provider: null, modelConfig: null };
}

export async function streamTurn(sessionId: string, text: string, requestedFunction: CognitiveFunction | null | undefined, callbacks: { onStart?: (value: { mode: "mock" | "real"; providerId: string; modelId: string | null; modelConfigId?: string }) => void; onDelta?: (value: string) => void }, abortSignal?: AbortSignal, mode: "auto" | "mock" | "real" = "auto", clientRequestId?: string) {
  const prepared = prepareStreamTurn(sessionId, text, requestedFunction, mode);
  if (prepared.decisionAction) {
    const candidate = prepared.before.nodes.find((node) => node.confirmable && node.epistemicStatus === "ai_proposal" && node.candidateReviewStatus === "pending");
    if (!candidate) throw new ProviderError("CANDIDATE_AMBIGUOUS", "当前没有待确认的候选表达");
    const note = prepared.decisionAction === "partial" || prepared.decisionAction === "misunderstood" ? prepared.move.text : undefined;
    const bundle = decideNode(sessionId, candidate.id, prepared.decisionAction, note, undefined, prepared.move.text);
    if (!bundle) throw new Error("保存决定后无法读取思想会话");
    return { bundle, action: prepared.move, decision: prepared.decision, patch: makeStatePatch(candidate.id, null, bundle?.session.phase ?? prepared.before.session.phase), assistantNodeId: null, mode: "mock" as const, providerId: "decision-service", modelId: null };
  }
  const resolved = prepared.resolved;
  if (!resolved?.modelConfig) throw new ProviderError("DEFAULT_MODEL_MISSING", "尚未配置默认模型", { type: "open-model-settings" });
  const pending = beginTurn(sessionId, text, requestedFunction, clientRequestId);
  const { streamIntervention } = await import("./providers/registry");
  const provider = getRuntimeProviderForModel(resolved.modelConfig.id);
  if (!provider) throw new ProviderError("CREDENTIAL_DECRYPT_FAILED", "当前 Provider 凭据不可用，请重新保存 API Key", { type: "open-provider-settings", targetId: resolved.provider?.id });
  const runtime = { mode: (resolved.mode === "mock" ? "mock" : "real") as "mock" | "real", providerId: provider.id, modelId: provider.modelId, modelConfigId: provider.modelConfigId };
  const runId = randomUUID();
  db.insert(interventionRuns).values({ id: runId, sessionId, eventId: null, providerId: runtime.providerId, modelId: runtime.modelId, modelConfigId: runtime.modelConfigId, mode: runtime.mode, status: "running", errorMessage: null, startedAt: pending.timestamp, completedAt: null }).run();
  callbacks.onStart?.(runtime);
  try {
    const context = buildThoughtContext({ bundle: pending.bundle, userText: pending.move.text, decision: pending.decision });
    const intervention = await streamIntervention(provider, pending.decision, context, callbacks.onDelta, abortSignal);
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

function safeProvider(row: typeof providerConfigs.$inferSelect, models: ModelConfig[] = []): SafeProviderConfig {
  const defaultModel = models.find((model) => model.isDefault);
  return {
    id: row.id, name: row.name, kind: row.kind as SafeProviderConfig["kind"], baseUrl: row.baseUrl ?? null,
    modelId: defaultModel?.modelId ?? row.modelId ?? null, enabled: row.enabled, isDefault: Boolean(defaultModel?.isDefault || row.isDefault),
    apiKeyMasked: row.apiKeyCiphertext ? (row.apiKeyLast4 ? "••••••••" + row.apiKeyLast4 : "已设置") : "未设置",
    headers: maskedHeaders(row), credentialStatus: row.credentialStatus as SafeProviderConfig["credentialStatus"],
    lastTestedAt: row.lastTestedAt ?? null, lastTestStatus: row.lastTestStatus as SafeProviderConfig["lastTestStatus"],
    lastTestErrorCode: row.lastTestErrorCode ?? null, modelCount: models.length,
    createdAt: row.createdAt, updatedAt: row.updatedAt,
  };
}

export function listProviders(): SafeProviderConfig[] {
  ensureDatabase();
  ensureDemoConfiguration();
  return db.select().from(providerConfigs).orderBy(desc(providerConfigs.updatedAt)).all().map((row) => safeProvider(row, listModels(row.id)));
}

export type ProviderInput = { id?: string; name: string; kind: SafeProviderConfig["kind"]; baseUrl?: string | null; apiKey?: string; modelId?: string | null; headers: Record<string, string>; enabled: boolean; isDefault?: boolean; credentialAction?: "keep" | "replace" | "clear" };
export function saveProvider(input: ProviderInput) {
  ensureDatabase();
  const timestamp = now();
  const existing = input.id ? db.select().from(providerConfigs).where(eq(providerConfigs.id, input.id)).get() : undefined;
  if (input.id && !existing) throw new Error("供应商不存在");
  const id = input.id ?? randomUUID();
  const credentialAction = input.credentialAction ?? (input.apiKey?.trim() ? "replace" : "keep");
  const ciphertext = credentialAction === "clear" ? null : credentialAction === "replace" && input.apiKey?.trim() ? encryptSecret(input.apiKey.trim()) : existing?.apiKeyCiphertext ?? null;
  const apiKeyLast4 = credentialAction === "clear" ? null : credentialAction === "replace" && input.apiKey?.trim() ? input.apiKey.trim().slice(-4) : existing?.apiKeyLast4 ?? null;
  const oldHeaders = existing?.headersCiphertext ? fromJson<Record<string, string>>(decryptSecret(existing.headersCiphertext), {}) : fromJson<Record<string, string>>(existing?.headers, {});
  const headerValues = Object.fromEntries(Object.entries(input.headers).map(([key, value]) => [key, value.startsWith("••••") || value === "已设置" ? oldHeaders[key] ?? "" : value]).filter(([, value]) => Boolean(value)));
  const headersCiphertext = Object.keys(headerValues).length ? encryptSecret(json(headerValues)) : null;
  const publicHeaders = Object.fromEntries(Object.entries(input.headers).map(([key, value]) => [key, value.startsWith("••••") || value === "已设置" ? value : maskHeader(value)]));
  const legacyDefault = Boolean(input.isDefault);
  runTransaction(() => {
    if (legacyDefault) db.update(providerConfigs).set({ isDefault: false, updatedAt: timestamp }).run();
    const values = { name: input.name, kind: input.kind, baseUrl: input.baseUrl ?? null, modelId: input.modelId ?? null, apiKeyCiphertext: ciphertext, apiKeyLast4, headers: json(publicHeaders), headersCiphertext, credentialStatus: input.kind === "mock" || ciphertext ? "configured" : "not_configured", lastTestedAt: existing?.lastTestedAt ?? null, lastTestStatus: existing?.lastTestStatus ?? null, lastTestErrorCode: existing?.lastTestErrorCode ?? null, enabled: input.enabled, isDefault: legacyDefault, updatedAt: timestamp };
    if (existing) db.update(providerConfigs).set(values).where(eq(providerConfigs.id, id)).run();
    else db.insert(providerConfigs).values({ id, ...values, createdAt: timestamp }).run();
    if (input.modelId?.trim()) {
      const modelId = input.modelId.trim();
      const model = db.select().from(modelConfigs).where(and(eq(modelConfigs.providerId, id), eq(modelConfigs.modelId, modelId))).get();
      if (legacyDefault) db.update(modelConfigs).set({ isDefault: false, updatedAt: timestamp }).run();
      if (model) db.update(modelConfigs).set({ displayName: model.displayName || modelId, enabled: input.enabled, isDefault: legacyDefault, updatedAt: timestamp }).where(eq(modelConfigs.id, model.id)).run();
      else db.insert(modelConfigs).values({ id: randomUUID(), providerId: id, modelId, displayName: modelId, enabled: input.enabled, isDefault: legacyDefault, source: "manual", capabilities: "{}", createdAt: timestamp, updatedAt: timestamp }).run();
    }
  });
  const row = db.select().from(providerConfigs).where(eq(providerConfigs.id, id)).get();
  if (!row) throw new Error("供应商保存失败");
  return safeProvider(row, listModels(id));
}

export function removeProvider(id: string) {
  ensureDatabase();
  db.delete(providerConfigs).where(eq(providerConfigs.id, id)).run();
}

export function listModels(providerId?: string): ModelConfig[] {
  ensureDatabase();
  const query = providerId ? db.select().from(modelConfigs).where(eq(modelConfigs.providerId, providerId)) : db.select().from(modelConfigs);
  return query.orderBy(desc(modelConfigs.updatedAt)).all().map(mapModel);
}

export function saveModel(input: { id?: string; providerId: string; modelId: string; displayName?: string; enabled: boolean; isDefault: boolean; source: "discovered" | "manual"; capabilities?: Record<string, boolean> }) {
  ensureDatabase();
  const provider = db.select().from(providerConfigs).where(eq(providerConfigs.id, input.providerId)).get();
  if (!provider) throw new Error("供应商不存在");
  const normalizedId = input.modelId.trim();
  const duplicate = db.select().from(modelConfigs).where(and(eq(modelConfigs.providerId, input.providerId), eq(modelConfigs.modelId, normalizedId))).get();
  if (duplicate && duplicate.id !== input.id) throw new Error("DUPLICATE_MODEL");
  if (input.isDefault && (!input.enabled || !provider.enabled)) throw new Error("停用的 Provider 或模型不能设为默认");
  const timestamp = now();
  return runTransaction(() => {
    if (input.isDefault) db.update(modelConfigs).set({ isDefault: false, updatedAt: timestamp }).run();
    const values = { providerId: input.providerId, modelId: normalizedId, displayName: input.displayName?.trim() || normalizedId, enabled: input.enabled, isDefault: input.isDefault, source: input.source, capabilities: json(input.capabilities ?? {}), updatedAt: timestamp };
    if (input.id) {
      const existing = db.select().from(modelConfigs).where(eq(modelConfigs.id, input.id)).get();
      if (!existing) throw new Error("模型不存在");
      db.update(modelConfigs).set(values).where(eq(modelConfigs.id, input.id)).run();
    } else db.insert(modelConfigs).values({ id: randomUUID(), ...values, createdAt: timestamp }).run();
    const row = input.id ? db.select().from(modelConfigs).where(eq(modelConfigs.id, input.id)).get() : db.select().from(modelConfigs).where(and(eq(modelConfigs.providerId, input.providerId), eq(modelConfigs.modelId, normalizedId))).get();
    if (!row) throw new Error("模型保存失败");
    return mapModel(row);
  });
}

export function removeModel(id: string) {
  ensureDatabase();
  const model = db.select().from(modelConfigs).where(eq(modelConfigs.id, id)).get();
  if (!model) return;
  runTransaction(() => {
    if (model.isDefault) {
      const replacement = db.select().from(modelConfigs).where(eq(modelConfigs.enabled, true)).all().find((item) => item.id !== id && Boolean(db.select({ id: providerConfigs.id }).from(providerConfigs).where(and(eq(providerConfigs.id, item.providerId), eq(providerConfigs.enabled, true))).get()));
      if (!replacement) throw new Error("不能删除唯一默认模型，请先添加并启用其他模型");
      db.update(modelConfigs).set({ isDefault: true, updatedAt: now() }).where(eq(modelConfigs.id, replacement.id)).run();
    }
    db.delete(modelConfigs).where(eq(modelConfigs.id, id)).run();
  });
}

export function setDefaultModel(id: string) {
  ensureDatabase();
  const model = db.select().from(modelConfigs).where(eq(modelConfigs.id, id)).get();
  if (!model) throw new Error("模型不存在");
  const provider = db.select().from(providerConfigs).where(eq(providerConfigs.id, model.providerId)).get();
  if (!model.enabled || !provider?.enabled) throw new Error("停用的 Provider 或模型不能设为默认");
  return runTransaction(() => {
    const timestamp = now();
    db.update(modelConfigs).set({ isDefault: false, updatedAt: timestamp }).run();
    db.update(modelConfigs).set({ isDefault: true, updatedAt: timestamp }).where(eq(modelConfigs.id, id)).run();
    return mapModel(db.select().from(modelConfigs).where(eq(modelConfigs.id, id)).get()!);
  });
}

export function recordProviderTest(providerId: string, result: { ok: boolean; code?: string }) {
  ensureDatabase();
  const timestamp = now();
  db.update(providerConfigs).set({
    lastTestedAt: timestamp,
    lastTestStatus: result.ok ? "success" : "failed",
    lastTestErrorCode: result.ok ? null : result.code ?? "CONNECTION_FAILED",
    credentialStatus: result.ok ? "configured" : undefined,
    updatedAt: timestamp,
  }).where(eq(providerConfigs.id, providerId)).run();
}

function ensureDemoConfiguration() {
  const timestamp = now();
  const provider = db.select().from(providerConfigs).where(eq(providerConfigs.kind, "mock")).get();
  const providerId = provider?.id ?? randomUUID();
  runTransaction(() => {
    if (!provider) db.insert(providerConfigs).values({ id: providerId, name: "本地演示模式", kind: "mock", baseUrl: null, modelId: "demo", apiKeyCiphertext: null, apiKeyLast4: null, headers: "{}", headersCiphertext: null, credentialStatus: "configured", lastTestedAt: null, lastTestStatus: null, lastTestErrorCode: null, enabled: true, isDefault: true, createdAt: timestamp, updatedAt: timestamp }).run();
    const demo = db.select().from(modelConfigs).where(and(eq(modelConfigs.providerId, providerId), eq(modelConfigs.modelId, "demo"))).get();
    const hasDefault = db.select().from(modelConfigs).where(eq(modelConfigs.isDefault, true)).get();
    if (!demo) db.insert(modelConfigs).values({ id: randomUUID(), providerId, modelId: "demo", displayName: "本地演示模型", enabled: true, isDefault: !hasDefault && Boolean(provider?.enabled ?? true), source: "manual", capabilities: json({ structuredOutput: true }), createdAt: timestamp, updatedAt: timestamp }).run();
    else if (!hasDefault && demo.enabled && Boolean(provider?.enabled ?? true)) db.update(modelConfigs).set({ isDefault: true, updatedAt: timestamp }).where(eq(modelConfigs.id, demo.id)).run();
  });
}

export type RuntimeConnection = SafeProviderConfig & { apiKey: string; headers: Record<string, string> };
export type RuntimeProvider = RuntimeConnection & { modelConfigId: string };
export function getProviderConnection(id: string): RuntimeConnection | null {
  ensureDatabase();
  const row = db.select().from(providerConfigs).where(and(eq(providerConfigs.id, id), eq(providerConfigs.enabled, true))).get();
  if (!row) return null;
  try {
    const models = listModels(id);
    const headers = row.headersCiphertext ? fromJson<Record<string, string>>(decryptSecret(row.headersCiphertext), {}) : fromJson<Record<string, string>>(row.headers, {});
    return { ...safeProvider(row, models), apiKey: row.apiKeyCiphertext ? decryptSecret(row.apiKeyCiphertext) : "", headers };
  } catch {
    return null;
  }
}
export function getProviderSecret(id: string): RuntimeProvider | null {
  const connection = getProviderConnection(id);
  if (!connection) return null;
  const models = listModels(id);
  const model = models.find((item) => item.isDefault) ?? models[0];
  if (!model) return null;
  return { ...connection, modelId: model.modelId, modelConfigId: model.id };
}
export function getRuntimeProviderForModel(modelConfigId: string): RuntimeProvider | null {
  ensureDatabase();
  const model = db.select().from(modelConfigs).where(eq(modelConfigs.id, modelConfigId)).get();
  if (!model) return null;
  const connection = getProviderConnection(model.providerId);
  if (!connection) return null;
  return { ...connection, modelId: model.modelId, modelConfigId: model.id };
}

export function resolveModelForFunction(cognitiveFunction: CognitiveFunction, mode: "auto" | "mock" | "real" = "auto") {
  ensureDatabase();
  ensureDemoConfiguration();
  const mapping = db.select().from(cognitiveFunctionModels).where(eq(cognitiveFunctionModels.cognitiveFunction, cognitiveFunction)).get();
  const mapped = mapping?.modelConfigId ? db.select().from(modelConfigs).where(eq(modelConfigs.id, mapping.modelConfigId)).get() : mapping?.providerId && mapping.modelId ? db.select().from(modelConfigs).where(and(eq(modelConfigs.providerId, mapping.providerId), eq(modelConfigs.modelId, mapping.modelId))).get() : undefined;
  const model = mode === "mock" ? db.select().from(modelConfigs).where(and(eq(modelConfigs.modelId, "demo"), eq(modelConfigs.isDefault, true))).get() ?? db.select().from(modelConfigs).where(eq(modelConfigs.modelId, "demo")).get() : mapped ?? db.select().from(modelConfigs).where(eq(modelConfigs.isDefault, true)).get();
  if (!model) return { modelConfig: null, provider: null, mode, readiness: { ok: false, code: "DEFAULT_MODEL_MISSING", message: "尚未配置默认模型" } };
  const providerRow = db.select().from(providerConfigs).where(eq(providerConfigs.id, model.providerId)).get();
  if (!providerRow) return { modelConfig: mapModel(model), provider: null, mode, readiness: { ok: false, code: "PROVIDER_NOT_FOUND", message: "模型所属 Provider 不存在" } };
  const provider = safeProvider(providerRow, listModels(providerRow.id));
  if (!providerRow.enabled) return { modelConfig: mapModel(model), provider, mode, readiness: { ok: false, code: "PROVIDER_DISABLED", message: "模型所属 Provider 已停用" } };
  if (!model.enabled) return { modelConfig: mapModel(model), provider, mode, readiness: { ok: false, code: "MODEL_DISABLED", message: "当前模型已停用" } };
  if (mode === "real" && providerRow.kind === "mock") return { modelConfig: mapModel(model), provider, mode, readiness: { ok: false, code: "MODEL_NOT_FOUND", message: "当前选择的是真实模型，但默认配置是演示模型" } };
  if (mode !== "mock" && providerRow.kind !== "mock" && !providerRow.apiKeyCiphertext) return { modelConfig: mapModel(model), provider, mode, readiness: { ok: false, code: "CREDENTIAL_MISSING", message: "当前 Provider 没有可用 API Key" } };
  return { modelConfig: mapModel(model), provider, mode: providerRow.kind === "mock" ? "mock" : "real", readiness: { ok: true, code: null, message: "模型已就绪" } };
}

export function getProviderForFunction(cognitiveFunction: CognitiveFunction): RuntimeProvider {
  const resolved = resolveModelForFunction(cognitiveFunction);
  if (!resolved.readiness.ok || !resolved.modelConfig || !resolved.provider) throw new ProviderError((resolved.readiness.code ?? "CONNECTION_FAILED") as ProviderErrorCode, resolved.readiness.message, { type: "open-model-settings", targetId: resolved.provider?.id });
  const runtime = getRuntimeProviderForModel(resolved.modelConfig.id);
  if (!runtime) throw new ProviderError("CREDENTIAL_DECRYPT_FAILED", "Provider 凭据不可用，请重新保存 API Key", { type: "open-provider-settings", targetId: resolved.provider.id });
  return runtime;
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
export function saveFunctionModels(models: Array<{ cognitiveFunction: string; providerId?: string | null; modelId?: string | null; modelConfigId?: string | null }>) {
  ensureDatabase();
  runTransaction(() => {
    for (const model of models) {
      if (!model.modelConfigId && Boolean(model.providerId) !== Boolean(model.modelId)) throw new Error("功能绑定必须选择现有模型，或留空继承默认模型");
      const selected = model.modelConfigId
        ? db.select().from(modelConfigs).where(eq(modelConfigs.id, model.modelConfigId)).get()
        : model.providerId && model.modelId
          ? db.select().from(modelConfigs).where(and(eq(modelConfigs.providerId, model.providerId), eq(modelConfigs.modelId, model.modelId))).get()
          : undefined;
      if (!model.modelConfigId && model.providerId && model.modelId && !selected) throw new Error("模型不存在");
      if (model.modelConfigId && !selected) throw new Error("模型不存在");
      if (selected && (!selected.enabled || !db.select().from(providerConfigs).where(and(eq(providerConfigs.id, selected.providerId), eq(providerConfigs.enabled, true))).get())) throw new Error("只能绑定已启用的模型");
      db.insert(cognitiveFunctionModels).values({ id: randomUUID(), cognitiveFunction: model.cognitiveFunction, providerId: selected?.providerId ?? model.providerId, modelId: selected?.modelId ?? model.modelId, modelConfigId: selected?.id ?? null, updatedAt: now() }).onConflictDoUpdate({ target: cognitiveFunctionModels.cognitiveFunction, set: { providerId: selected?.providerId ?? model.providerId, modelId: selected?.modelId ?? model.modelId, modelConfigId: selected?.id ?? null, updatedAt: now() } }).run();
    }
  });
  return listFunctionModels();
}
export function saveFunctionModel(cognitiveFunction: string, providerId: string | null, modelId: string | null) { return saveFunctionModels([{ cognitiveFunction, providerId, modelId }]); }

export function decideNode(sessionId: string, nodeId: string, action: "accept" | "partial" | "misunderstood" | "candidate" | "reject", note?: string, content?: string, eventText?: string) {
  ensureDatabase();
  const row = db.select().from(thoughtNodes).where(and(eq(thoughtNodes.id, nodeId), eq(thoughtNodes.sessionId, sessionId))).get();
  if (!row) throw new Error("找不到这个思想节点，或它不属于当前会话");
  const node = mapNode(row);
  if (!node.confirmable || node.epistemicStatus !== "ai_proposal" || node.candidateReviewStatus !== "pending") throw new Error("只有待确认的 AI 候选表达可以执行此操作");
  if ((action === "partial" || action === "misunderstood") && !note?.trim()) throw new Error("部分接受或纠正时，请补充你的说明");
  const timestamp = now();
  const eventId = randomUUID();
  const decisionResult = applyDecision(node.epistemicStatus, action);
  const reviewStatus: CandidateReviewStatus = action === "accept" ? "accepted" : action === "partial" ? "partial" : action === "misunderstood" ? "corrected" : action === "reject" ? "rejected" : "deferred";
  const createsUserNode = action === "accept" || action === "partial" || action === "misunderstood" || (action === "reject" && Boolean(note?.trim()));
  const userNodeId = createsUserNode ? randomUUID() : null;
  const eventType = action === "accept" ? "user_confirmation" : action === "reject" ? "user_rejection" : action === "candidate" ? "node_status_changed" : "user_correction";
  const nodeContent = action === "accept" ? content?.trim() || node.content : content?.trim() || note?.trim() || node.content;
  runTransaction(() => {
    if (userNodeId) {
      const type = action === "accept" ? "accepted_claim" : action === "reject" ? "revision" : "revision";
      db.insert(thoughtNodes).values({ id: userNodeId, sessionId, type, content: nodeContent, author: "user", epistemicStatus: action === "accept" ? "user_accepted" : action === "reject" ? "user_rejected" : decisionResult.epistemicStatus, parentNodeId: node.id, sourceEventIds: json([eventId]), speechAct: action === "accept" ? "candidate_claim" : "record", confirmable: false, candidateReviewStatus: null, provenanceNodeId: node.id, createdAt: timestamp, updatedAt: timestamp }).run();
      const edgeType = action === "accept" ? "accepted_by_user" : action === "partial" ? "partially_accepts" : action === "misunderstood" || action === "reject" ? "corrects" : "responds_to";
      if (node.id !== userNodeId) db.insert(thoughtEdges).values({ id: randomUUID(), sessionId, sourceNodeId: node.id, targetNodeId: userNodeId, type: edgeType, createdAt: timestamp }).run();
    }
    db.update(thoughtNodes).set({ confirmable: false, candidateReviewStatus: reviewStatus, updatedAt: timestamp }).where(eq(thoughtNodes.id, node.id)).run();
    db.insert(conversationEvents).values({ id: eventId, sessionId, type: eventType, actor: "user", content: eventText?.trim() || note?.trim() || action, cognitiveFunction: null, speechAct: action === "accept" ? "candidate_claim" : "record", userAction: action === "accept" ? "accept_candidate" : action === "partial" ? "partially_accept" : action === "misunderstood" ? "correct_candidate" : action === "reject" ? "reject_interpretation" : null, confirmable: false, nodeIds: json([node.id, ...(userNodeId ? [userNodeId] : [])]), metadata: json({ action, candidateNodeId: node.id }), createdAt: timestamp }).run();
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
    for (const node of parsed.nodes) db.insert(thoughtNodes).values({ ...node, id: nodeIds.get(node.id)!, sessionId, parentNodeId: rewriteNode(node.parentNodeId), sourceEventIds: json(node.sourceEventIds.map((id) => eventIds.get(id) ?? id)), candidateReviewStatus: node.candidateReviewStatus ?? (node.confirmable ? "pending" : null), provenanceNodeId: rewriteNode(node.provenanceNodeId) }).run();
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
