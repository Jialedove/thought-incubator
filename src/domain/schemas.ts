import { z } from "zod";
import { candidateReviewStatuses, cognitiveFunctions, epistemicStatuses, eventTypes, speechActs, thoughtEdgeTypes, thoughtNodeTypes, thoughtPhases, userMoveKinds } from "./types";

export const cognitiveFunctionSchema = z.enum(cognitiveFunctions);
export const thoughtNodeTypeSchema = z.enum(thoughtNodeTypes);
export const epistemicStatusSchema = z.enum(epistemicStatuses);
export const speechActSchema = z.enum(speechActs);
export const thoughtEdgeTypeSchema = z.enum(thoughtEdgeTypes);
export const thoughtPhaseSchema = z.enum(thoughtPhases);
export const eventTypeSchema = z.enum(eventTypes);
export const userMoveKindSchema = z.enum(userMoveKinds);
export const candidateReviewStatusSchema = z.enum(candidateReviewStatuses);

export const userActionSchema = z.object({
  kind: userMoveKindSchema,
  text: z.string().trim().min(1).max(10_000),
  targetNodeId: z.string().nullable().optional(),
});
export const interventionResultSchema = z.object({
  cognitiveFunction: cognitiveFunctionSchema,
  speechAct: speechActSchema,
  message: z.string().trim().min(1).max(10_000),
  confirmable: z.boolean(),
  proposedNode: z.object({
    type: thoughtNodeTypeSchema,
    content: z.string().trim().min(1).max(10_000),
    epistemicStatus: epistemicStatusSchema,
  }).optional(),
  targetNodeIds: z.array(z.string()),
  suggestedPhase: thoughtPhaseSchema,
  shouldWaitForUser: z.literal(true),
});
export const thoughtStatePatchSchema = z.object({
  createNodes: z.array(z.object({
    type: thoughtNodeTypeSchema, content: z.string().min(1).max(10_000),
    author: z.enum(["user", "system"]), epistemicStatus: epistemicStatusSchema,
    parentNodeId: z.string().nullable().optional(),
  })),
  updateNodes: z.array(z.object({
    id: z.string().min(1), content: z.string().min(1).max(10_000).optional(),
    type: thoughtNodeTypeSchema.optional(), epistemicStatus: epistemicStatusSchema.optional(),
  })),
  createEdges: z.array(z.object({
    sourceNodeId: z.string().min(1), targetNodeId: z.string().min(1), type: thoughtEdgeTypeSchema,
  })).superRefine((edges, context) => {
    if (edges.some((edge) => edge.sourceNodeId === edge.targetNodeId)) context.addIssue({ code: "custom", message: "思想关系不能连接节点自身" });
  }),
  currentFocusNodeId: z.string().nullable().optional(), phase: thoughtPhaseSchema.optional(),
});
export const interventionDecisionSchema = z.object({
  cognitiveFunction: cognitiveFunctionSchema, targetNodeIds: z.array(z.string()),
  purpose: z.string().min(1).max(500), shouldWaitForUser: z.literal(true), allowMultiPerspective: z.boolean(),
});
export const createSessionSchema = z.object({ title: z.string().trim().min(1).max(120).optional() });
export const messageSchema = z.object({
  text: z.string().trim().min(1).max(10_000), requestedFunction: cognitiveFunctionSchema.nullable().optional(),
  mode: z.enum(["auto", "mock", "real"]).optional().default("auto"),
  clientRequestId: z.string().trim().min(1).max(100).optional(),
});
export const decisionActionSchema = z.object({
  nodeId: z.string().min(1),
  action: z.enum(["accept", "partial", "misunderstood", "candidate", "reject"]),
  note: z.string().trim().max(2_000).optional(),
  content: z.string().trim().max(10_000).optional(),
});
const providerBase = z.object({
  id: z.string().min(1).optional(),
  name: z.string().trim().min(1).max(100),
  kind: z.enum(["openai", "anthropic", "google", "openai-compatible", "mock"]),
  baseUrl: z.string().trim().max(500).nullable().optional(),
  apiKey: z.string().max(500).optional(),
  modelId: z.string().trim().max(200).nullable().optional(),
  headers: z.record(z.string(), z.string()).default({}),
  enabled: z.boolean().default(true), isDefault: z.boolean().default(false),
  credentialAction: z.enum(["keep", "replace", "clear"]).optional().default("keep"),
});
export const providerInputSchema = providerBase.superRefine((value, context) => {
  if (value.kind === "openai-compatible") {
    try { new URL(value.baseUrl ?? ""); } catch { context.addIssue({ code: "custom", path: ["baseUrl"], message: "兼容服务必须填写有效 Base URL" }); }
  }
});
export const functionModelInputSchema = z.object({ cognitiveFunction: cognitiveFunctionSchema, modelConfigId: z.string().nullable().optional(), providerId: z.string().nullable().optional(), modelId: z.string().trim().max(200).nullable().optional() });
export const functionModelsSchema = z.object({ models: z.array(functionModelInputSchema).length(cognitiveFunctions.length) });
export const modelInputSchema = z.object({
  id: z.string().min(1).optional(), providerId: z.string().min(1), modelId: z.string().trim().min(1).max(200),
  displayName: z.string().trim().min(1).max(200).optional(), enabled: z.boolean().default(true),
  isDefault: z.boolean().default(false), source: z.enum(["discovered", "manual"]).default("manual"),
  capabilities: z.record(z.string(), z.boolean()).default({}),
});
export const sessionBundleSchema = z.object({
  schemaVersion: z.literal(2),
  session: z.object({ id: z.string(), title: z.string(), originalIntent: z.string().nullable(), currentFocusNodeId: z.string().nullable(), phase: thoughtPhaseSchema, status: z.enum(["active", "paused", "matured", "archived"]), createdAt: z.number(), updatedAt: z.number() }),
  nodes: z.array(z.object({ id: z.string(), sessionId: z.string(), type: thoughtNodeTypeSchema, content: z.string(), author: z.enum(["user", "system"]), epistemicStatus: epistemicStatusSchema, parentNodeId: z.string().nullable(), sourceEventIds: z.array(z.string()), speechAct: speechActSchema.nullable(), confirmable: z.boolean(), candidateReviewStatus: candidateReviewStatusSchema.nullable().optional(), provenanceNodeId: z.string().nullable(), createdAt: z.number(), updatedAt: z.number() })),
  edges: z.array(z.object({ id: z.string(), sessionId: z.string(), sourceNodeId: z.string(), targetNodeId: z.string(), type: thoughtEdgeTypeSchema, createdAt: z.number() })),
  events: z.array(z.object({ id: z.string(), sessionId: z.string(), type: eventTypeSchema, actor: z.enum(["user", "assistant", "system"]), content: z.string(), cognitiveFunction: cognitiveFunctionSchema.nullable(), speechAct: speechActSchema.nullable(), userAction: userMoveKindSchema.nullable(), confirmable: z.boolean(), nodeIds: z.array(z.string()), metadata: z.record(z.string(), z.string()), createdAt: z.number() })),
  runs: z.array(z.object({ id: z.string(), sessionId: z.string(), eventId: z.string().nullable(), providerId: z.string(), modelId: z.string().nullable(), modelConfigId: z.string().nullable().optional(), mode: z.enum(["mock", "real"]), status: z.enum(["running", "completed", "failed", "aborted"]), errorMessage: z.string().nullable(), startedAt: z.number(), completedAt: z.number().nullable() })).optional(),
});
