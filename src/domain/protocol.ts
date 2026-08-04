import type { CognitiveFunction, EpistemicStatus, InterventionDecision, InterventionResult, SessionBundle, SpeechAct, ThoughtEdgeType, ThoughtNode, ThoughtPhase, ThoughtStatePatch, UserMove, UserMoveKind } from "./types";
import { interventionDecisionSchema, interventionResultSchema, userActionSchema } from "./schemas";

const includes = (text: string, words: string[]) => words.some((word) => text.includes(word));

export function classifyUserAction(text: string, bundle?: SessionBundle): UserMove {
  const trimmed = text.trim();
  const candidate = bundle?.nodes.find((node) => node.confirmable && node.epistemicStatus === "ai_proposal");
  const openQuestion = bundle?.nodes.some((node) => node.type === "open_question" && node.epistemicStatus !== "user_rejected");
  const kind: UserMoveKind =
    includes(trimmed, ["接受", "准确表达", "我认同", "同意这个候选"]) ? "accept_candidate" :
    includes(trimmed, ["部分接受", "部分准确", "一半对", "但我想改"]) ? "partially_accept" :
    includes(trimmed, ["误解", "不是这个意思", "不对", "纠正"]) ? "correct_candidate" :
    includes(trimmed, ["拒绝", "不要这个解释"]) ? "reject_interpretation" :
    includes(trimmed, ["挑战", "反例", "哪里不对", "边界"]) ? "request_challenge" :
    includes(trimmed, ["延展", "再往前", "还有什么可能"]) ? "request_extension" :
    includes(trimmed, ["连接", "关联", "联系起来"]) ? "request_connection" :
    includes(trimmed, ["重述", "换个说法", "重新表达"]) ? "request_reformulation" :
    includes(trimmed, ["多视角", "不同角度", "另一种看法"]) ? "request_multi_perspective" :
    includes(trimmed, ["总结", "临时总结", "整理一下"]) ? "request_summary" :
    includes(trimmed, ["切换焦点", "换个念头", "另一个分支"]) ? "switch_focus" :
    includes(trimmed, ["例子", "举例", "经历", "具体场景"]) ? "give_example" :
    includes(trimmed, ["澄清", "概念", "到底是什么意思", "定义"]) ? "clarify_concept" :
    includes(trimmed, ["改成", "更准确", "其实", "我想修订", "重新说"]) ? "revise_view" :
    openQuestion && includes(trimmed, ["因为", "所以", "我的答案", "回答", "是"]) ? "answer_question" :
    "new_intuition";
  return userActionSchema.parse({ kind, text: trimmed, targetNodeId: candidate?.id ?? null });
}

const purpose: Record<CognitiveFunction, string> = {
  mirror: "先确认你正在指向什么", clarify: "把一个容易混在一起的词说清楚",
  distinguish: "拆开两个可能不同的判断", ground: "把想法带回一个具体场景",
  challenge: "检查这个想法的边界或反例", extend: "看看这个想法还可能走向哪里",
  connect: "连接当前会话里已经出现的节点", reformulate: "提出一句仍待你确认的候选表达",
  facilitate: "判断下一步最值得推进的地方", record: "记录这次思想发生了什么变化",
};

const requestedFunctionForMove: Partial<Record<UserMoveKind, CognitiveFunction>> = {
  request_challenge: "challenge", request_extension: "extend", request_connection: "connect",
  request_reformulation: "reformulate", request_summary: "record", give_example: "ground",
  clarify_concept: "clarify", request_multi_perspective: "distinguish",
};

function latestFunction(bundle: SessionBundle) {
  return [...bundle.events].reverse().find((event) => event.cognitiveFunction)?.cognitiveFunction ?? null;
}

export function chooseIntervention(bundle: SessionBundle, requestedFunction?: CognitiveFunction | null, move?: UserMove): InterventionDecision {
  const nodes = bundle.nodes;
  const unresolved = nodes.filter((node) => node.type === "open_question" && node.epistemicStatus !== "user_rejected");
  const candidates = nodes.filter((node) => node.confirmable && node.epistemicStatus === "ai_proposal");
  const original = nodes.find((node) => node.type === "original_expression");
  const latest = latestFunction(bundle);
  const automatic = move ? requestedFunctionForMove[move.kind] : undefined;
  let cognitiveFunction = requestedFunction ?? automatic;
  if (!cognitiveFunction) {
    cognitiveFunction = original === undefined ? "mirror" :
      move?.kind === "answer_question" ? "clarify" :
      move?.kind === "revise_view" || move?.kind === "correct_candidate" ? "distinguish" :
      candidates.length > 0 && latest !== "reformulate" ? "reformulate" :
      unresolved.length > 0 && latest !== "ground" ? "ground" :
      latest === "clarify" ? "distinguish" : "facilitate";
  }
  if (!requestedFunction && !automatic && cognitiveFunction === latest) {
    cognitiveFunction = cognitiveFunction === "clarify" ? "distinguish" : cognitiveFunction === "distinguish" ? "ground" : "facilitate";
  }
  const currentFocus = bundle.session.currentFocusNodeId ? nodes.find((node) => node.id === bundle.session.currentFocusNodeId) : undefined;
  const focus = unresolved.at(-1) ?? candidates.at(-1) ?? currentFocus ?? original ?? nodes.at(-1);
  return interventionDecisionSchema.parse({
    cognitiveFunction, targetNodeIds: focus ? [focus.id] : [], purpose: purpose[cognitiveFunction],
    shouldWaitForUser: true, allowMultiPerspective: move?.kind === "request_multi_perspective",
  });
}

const phaseFor: Record<CognitiveFunction, ThoughtPhase> = {
  facilitate: "clarifying", mirror: "clarifying", clarify: "clarifying", distinguish: "differentiating",
  ground: "grounding", challenge: "testing", extend: "expanding", connect: "expanding",
  reformulate: "reformulating", record: "reflecting",
};

const textFor = (functionName: CognitiveFunction, trimmed: string) => ({
  mirror: `我先这样听见它：你似乎在说“${trimmed}”。这句话里，哪一部分最想被认真看见？`,
  clarify: `这里的“${trimmed.slice(0, 24)}”更接近一种感受、判断，还是你希望采取的行动？`,
  distinguish: "这里可能混着两件事：你经历了什么，以及你由此得出的判断。你想先拆开哪一件？",
  ground: "如果把它放进最近一次真实发生的场景里，具体发生了什么？",
  challenge: "如果这个想法只在某些情况下成立，最先失效的边界会在哪里？",
  extend: "如果顺着这个想法再走一步，它会要求你重新理解什么？",
  connect: "这和你前面提到的另一个念头之间，是支持、冲突，还是只是相邻？",
  reformulate: `候选表达：也许你在意的不是“${trimmed}”，而是它如何影响你接下来愿意做什么。准确吗？`,
  facilitate: "现在最值得推进的，可能不是得出结论，而是找到一个可以继续追问的具体位置。你想从哪里开始？",
  record: "我先记下这个变化：你正在把一个模糊直觉变成可以检查的表达。接下来希望保留什么？",
}[functionName]);

export function mockIntervention(functionName: CognitiveFunction, text: string): InterventionResult {
  const trimmed = text.trim().replace(/[。！？!?]+$/, "");
  const speechAct: SpeechAct = functionName === "mirror" ? "mirror" : functionName === "reformulate" ? "candidate_claim" : functionName === "distinguish" ? "distinction" : functionName === "connect" ? "connection" : functionName === "record" ? "temporary_summary" : "question";
  const confirmable = speechAct === "candidate_claim";
  const proposedNode = confirmable
    ? { type: "candidate_interpretation" as const, content: textFor(functionName, trimmed), epistemicStatus: "ai_proposal" as const }
    : functionName === "record"
      ? { type: "temporary_summary" as const, content: textFor(functionName, trimmed), epistemicStatus: "ai_interpretation" as const }
      : functionName === "ground" || functionName === "challenge"
        ? { type: "open_question" as const, content: textFor(functionName, trimmed), epistemicStatus: "unresolved" as const }
        : undefined;
  return interventionResultSchema.parse({
    cognitiveFunction: functionName, speechAct, message: textFor(functionName, trimmed), confirmable,
    proposedNode, targetNodeIds: [], suggestedPhase: phaseFor[functionName], shouldWaitForUser: true,
  });
}

export function normalizeIntervention(result: InterventionResult, expectedFunction: CognitiveFunction, targetNodeIds: string[]): InterventionResult {
  const parsed = interventionResultSchema.parse({ ...result, cognitiveFunction: expectedFunction, targetNodeIds, shouldWaitForUser: true });
  if (parsed.confirmable !== (parsed.speechAct === "candidate_claim") || (parsed.confirmable && !parsed.proposedNode)) throw new Error("模型返回的候选语义不完整");
  if (parsed.speechAct !== "candidate_claim" && parsed.confirmable) throw new Error("普通介入不能请求观点确认");
  return parsed;
}

export function applyDecision(status: EpistemicStatus, action: "accept" | "partial" | "misunderstood" | "candidate" | "reject"): { epistemicStatus: EpistemicStatus; nodeType: ThoughtNode["type"] } {
  if (status !== "ai_proposal") throw new Error("只有可确认的 AI 候选内容可以被确认");
  if (action === "accept") return { epistemicStatus: "user_accepted", nodeType: "accepted_claim" };
  if (action === "partial") return { epistemicStatus: "partially_accepted", nodeType: "revision" };
  if (action === "misunderstood" || action === "reject") return { epistemicStatus: "user_rejected", nodeType: "rejected_claim" };
  return { epistemicStatus: "ai_proposal", nodeType: "candidate_interpretation" };
}

export function edgeForUserMove(move: UserMoveKind): ThoughtEdgeType {
  return move === "answer_question" ? "answers" : move === "give_example" ? "provides_example_for" : move === "revise_view" || move === "partially_accept" ? "revises" : move === "correct_candidate" ? "corrects" : move === "switch_focus" ? "branches_from" : "responds_to";
}

export function makeStatePatch(userNodeId: string, assistantNodeId: string | null, phase: ThoughtPhase, edgeType: ThoughtEdgeType = "clarifies"): ThoughtStatePatch {
  return { createNodes: [], updateNodes: [], createEdges: assistantNodeId ? [{ sourceNodeId: userNodeId, targetNodeId: assistantNodeId, type: edgeType }] : [], currentFocusNodeId: assistantNodeId ?? userNodeId, phase };
}
