export const cognitiveFunctions = [
  "facilitate", "mirror", "clarify", "distinguish", "ground",
  "challenge", "extend", "connect", "reformulate", "record",
] as const;

export type CognitiveFunction = (typeof cognitiveFunctions)[number];
export const thoughtPhases = [
  "expressing", "clarifying", "differentiating", "grounding",
  "testing", "expanding", "reformulating", "reflecting",
] as const;
export type ThoughtPhase = (typeof thoughtPhases)[number];
export type SessionStatus = "active" | "paused" | "matured" | "archived";
export type Author = "user" | "system";
export const thoughtNodeTypes = [
  "original_expression", "candidate_interpretation", "distinction", "example",
  "counterexample", "evidence", "accepted_claim", "rejected_claim",
  "open_question", "revision", "temporary_summary",
] as const;
export type ThoughtNodeType = (typeof thoughtNodeTypes)[number];
export const epistemicStatuses = [
  "user_original", "ai_interpretation", "ai_proposal", "user_accepted",
  "user_rejected", "partially_accepted", "unresolved",
] as const;
export type EpistemicStatus = (typeof epistemicStatuses)[number];
export const thoughtEdgeTypes = [
  "clarifies", "distinguishes", "supports", "challenges", "contradicts",
  "extends", "revises", "branches_from", "accepted_by_user", "rejected_by_user",
] as const;
export type ThoughtEdgeType = (typeof thoughtEdgeTypes)[number];
export const eventTypes = [
  "user_message", "ai_mirror", "ai_question", "ai_candidate",
  "user_confirmation", "user_correction", "user_rejection",
  "node_status_changed", "focus_changed", "branch_created",
] as const;
export type ConversationEventType = (typeof eventTypes)[number];

export type ThoughtSession = {
  id: string; title: string; originalIntent: string | null;
  currentFocusNodeId: string | null; phase: ThoughtPhase; status: SessionStatus;
  createdAt: number; updatedAt: number;
};
export type ThoughtNode = {
  id: string; sessionId: string; type: ThoughtNodeType; content: string;
  author: Author; epistemicStatus: EpistemicStatus; parentNodeId: string | null;
  sourceEventIds: string[]; createdAt: number; updatedAt: number;
};
export type ThoughtEdge = {
  id: string; sessionId: string; sourceNodeId: string; targetNodeId: string;
  type: ThoughtEdgeType; createdAt: number;
};
export type ConversationEvent = {
  id: string; sessionId: string; type: ConversationEventType; content: string;
  cognitiveFunction: CognitiveFunction | null; nodeIds: string[]; createdAt: number;
};
export type SessionBundle = {
  session: ThoughtSession; nodes: ThoughtNode[]; edges: ThoughtEdge[]; events: ConversationEvent[];
};
export type ThoughtStatePatch = {
  createNodes: Array<{ type: ThoughtNodeType; content: string; author: Author; epistemicStatus: EpistemicStatus; parentNodeId?: string | null }>;
  updateNodes: Array<{ id: string; content?: string; type?: ThoughtNodeType; epistemicStatus?: EpistemicStatus }>;
  createEdges: Array<{ sourceNodeId: string; targetNodeId: string; type: ThoughtEdgeType }>;
  currentFocusNodeId?: string | null; phase?: ThoughtPhase;
};
export type InterventionDecision = {
  cognitiveFunction: CognitiveFunction; targetNodeIds: string[]; purpose: string;
  shouldWaitForUser: boolean; allowMultiPerspective: boolean;
};
export type ProviderKind = "openai" | "anthropic" | "google" | "openai-compatible" | "mock";
export type SafeProviderConfig = {
  id: string; name: string; kind: ProviderKind; baseUrl: string | null;
  modelId: string | null; enabled: boolean; isDefault: boolean;
  apiKeyMasked: string; headers: Record<string, string>;
  createdAt: number; updatedAt: number;
};
