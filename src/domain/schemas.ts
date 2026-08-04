import { z } from "zod";
import { cognitiveFunctions, epistemicStatuses, eventTypes, thoughtEdgeTypes, thoughtNodeTypes, thoughtPhases } from "./types";

export const cognitiveFunctionSchema = z.enum(cognitiveFunctions);
export const thoughtNodeTypeSchema = z.enum(thoughtNodeTypes);
export const epistemicStatusSchema = z.enum(epistemicStatuses);
export const thoughtEdgeTypeSchema = z.enum(thoughtEdgeTypes);
export const thoughtPhaseSchema = z.enum(thoughtPhases);
export const eventTypeSchema = z.enum(eventTypes);

export const userActionSchema = z.object({
  kind: z.enum(["new_intuition", "answer_question", "clarify_concept", "revise_view", "give_example", "accept_candidate", "partially_accept", "reject_interpretation", "request_challenge", "request_extension", "request_multi_perspective", "switch_branch", "summarize"]),
  text: z.string().min(1).max(10_000),
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
  })),
  currentFocusNodeId: z.string().nullable().optional(), phase: thoughtPhaseSchema.optional(),
});
export const interventionDecisionSchema = z.object({
  cognitiveFunction: cognitiveFunctionSchema, targetNodeIds: z.array(z.string()),
  purpose: z.string().min(1).max(500), shouldWaitForUser: z.boolean(), allowMultiPerspective: z.boolean(),
});
export const createSessionSchema = z.object({ title: z.string().trim().min(1).max(120).optional() });
export const messageSchema = z.object({
  text: z.string().trim().min(1).max(10_000), requestedFunction: cognitiveFunctionSchema.nullable().optional(),
});
export const decisionActionSchema = z.object({
  nodeId: z.string().min(1),
  action: z.enum(["accept", "partial", "misunderstood", "candidate", "reject"]),
  note: z.string().trim().max(2_000).optional(),
});
export const providerInputSchema = z.object({
  name: z.string().trim().min(1).max(100),
  kind: z.enum(["openai", "anthropic", "google", "openai-compatible", "mock"]),
  baseUrl: z.string().trim().max(500).nullable().optional(),
  apiKey: z.string().max(500).optional(),
  modelId: z.string().trim().max(200).nullable().optional(),
  headers: z.record(z.string(), z.string()).default({}),
  enabled: z.boolean().default(true), isDefault: z.boolean().default(false),
});
