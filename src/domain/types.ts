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
  "original_expression", "answer", "candidate_interpretation", "distinction", "example",
  "counterexample", "evidence", "accepted_claim", "rejected_claim", "open_question",
  "revision", "temporary_summary",
] as const;
export type ThoughtNodeType = (typeof thoughtNodeTypes)[number];

export const epistemicStatuses = [
  "user_original", "ai_interpretation", "ai_proposal", "user_accepted",
  "user_rejected", "partially_accepted", "unresolved",
] as const;
export type EpistemicStatus = (typeof epistemicStatuses)[number];

export const speechActs = [
  "question", "mirror", "distinction", "candidate_claim", "counterexample",
  "example_request", "connection", "temporary_summary", "record",
] as const;
export type SpeechAct = (typeof speechActs)[number];

export const userMoveKinds = [
  "new_intuition", "answer_question", "clarify_concept", "revise_view", "give_example",
  "request_example", "request_challenge", "request_extension", "request_connection", "request_reformulation",
  "request_multi_perspective", "switch_focus", "accept_candidate", "partially_accept",
  "correct_candidate", "reject_interpretation", "request_summary",
] as const;
export type UserMoveKind = (typeof userMoveKinds)[number];
export type UserMove = { kind: UserMoveKind; text: string; targetNodeId?: string | null };

export const thoughtEdgeTypes = [
  "responds_to", "provides_example_for", "partially_accepts", "corrects", "answers",
  "clarifies", "distinguishes", "supports", "challenges", "contradicts", "extends",
  "revises", "branches_from", "accepted_by_user", "rejected_by_user",
] as const;
export type ThoughtEdgeType = (typeof thoughtEdgeTypes)[number];

export const eventTypes = [
  "user_message", "ai_mirror", "ai_question", "ai_candidate", "ai_record",
  "user_confirmation", "user_correction", "user_rejection", "node_status_changed",
  "focus_changed", "branch_created",
] as const;
export type ConversationEventType = (typeof eventTypes)[number];
export type EventActor = "user" | "assistant" | "system";

export type ThoughtSession = {
  id: string; title: string; originalIntent: string | null;
  currentFocusNodeId: string | null; phase: ThoughtPhase; status: SessionStatus;
  createdAt: number; updatedAt: number;
};
export type ThoughtNode = {
  id: string; sessionId: string; type: ThoughtNodeType; content: string;
  author: Author; epistemicStatus: EpistemicStatus; parentNodeId: string | null;
  sourceEventIds: string[]; speechAct: SpeechAct | null; confirmable: boolean;
  candidateReviewStatus: CandidateReviewStatus | null;
  provenanceNodeId: string | null; createdAt: number; updatedAt: number;
};
export const candidateReviewStatuses = ["pending", "accepted", "partial", "corrected", "rejected", "deferred"] as const;
export type CandidateReviewStatus = (typeof candidateReviewStatuses)[number];
export type ThoughtEdge = {
  id: string; sessionId: string; sourceNodeId: string; targetNodeId: string;
  type: ThoughtEdgeType; createdAt: number;
};
export type ConversationEvent = {
  id: string; sessionId: string; type: ConversationEventType; actor: EventActor;
  content: string; cognitiveFunction: CognitiveFunction | null; speechAct: SpeechAct | null;
  userAction: UserMoveKind | null; confirmable: boolean; nodeIds: string[];
  metadata: Record<string, string>; createdAt: number;
};
export type InterventionRun = {
  id: string; sessionId: string; eventId: string | null; providerId: string;
  modelId: string | null; modelConfigId?: string | null; mode: "mock" | "real"; status: "running" | "completed" | "failed" | "aborted";
  errorMessage: string | null; startedAt: number; completedAt: number | null;
};
export type SessionBundle = {
  session: ThoughtSession; nodes: ThoughtNode[]; edges: ThoughtEdge[]; events: ConversationEvent[]; runs?: InterventionRun[];
};
export type ThoughtStatePatch = {
  createNodes: Array<{ type: ThoughtNodeType; content: string; author: Author; epistemicStatus: EpistemicStatus; parentNodeId?: string | null }>;
  updateNodes: Array<{ id: string; content?: string; type?: ThoughtNodeType; epistemicStatus?: EpistemicStatus }>;
  createEdges: Array<{ sourceNodeId: string; targetNodeId: string; type: ThoughtEdgeType }>;
  currentFocusNodeId?: string | null; phase?: ThoughtPhase;
};
export type InterventionDecision = {
  cognitiveFunction: CognitiveFunction; targetNodeIds: string[]; purpose: string;
  shouldWaitForUser: true; allowMultiPerspective: boolean;
};
export type ProposedNode = {
  type: ThoughtNodeType; content: string; epistemicStatus: EpistemicStatus;
};
export type InterventionResult = {
  cognitiveFunction: CognitiveFunction; speechAct: SpeechAct; message: string;
  confirmable: boolean; proposedNode?: ProposedNode; targetNodeIds: string[];
  suggestedPhase: ThoughtPhase; shouldWaitForUser: true;
};
export type ProviderKind = "openai" | "anthropic" | "google" | "openai-compatible" | "mock";
export type ProviderCredentialStatus = "not_configured" | "configured" | "invalid" | "unreadable";
export type ProviderTestStatus = "success" | "failed" | null;
export type ModelSource = "discovered" | "manual";
export type ModelConfig = {
  id: string; providerId: string; modelId: string; displayName: string; enabled: boolean;
  isDefault: boolean; source: ModelSource; capabilities: Record<string, boolean>;
  createdAt: number; updatedAt: number;
};
export type SafeProviderConfig = {
  id: string; name: string; kind: ProviderKind; baseUrl: string | null;
  modelId: string | null; enabled: boolean; isDefault: boolean;
  apiKeyMasked: string; headers: Record<string, string>; credentialStatus: ProviderCredentialStatus;
  lastTestedAt: number | null; lastTestStatus: ProviderTestStatus; lastTestErrorCode: string | null;
  modelCount: number;
  createdAt: number; updatedAt: number;
};
export type ResolvedModel = {
  modelConfig: ModelConfig; provider: SafeProviderConfig; mode: "mock" | "real";
  readiness: { ok: boolean; code: string | null; message: string };
};
export type ProviderErrorCode =
  | "VALIDATION_ERROR" | "PROVIDER_NOT_FOUND" | "PROVIDER_DISABLED" | "MODEL_NOT_FOUND"
  | "MODEL_DISABLED" | "DEFAULT_MODEL_MISSING" | "CREDENTIAL_MISSING" | "CREDENTIAL_DECRYPT_FAILED"
  | "CONNECTION_FAILED" | "MODEL_NOT_FOUND_REMOTE" | "REQUEST_ABORTED" | "INVALID_MODEL_OUTPUT"
  | "DUPLICATE_MODEL" | "CANDIDATE_AMBIGUOUS";
