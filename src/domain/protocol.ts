import type { CognitiveFunction, EpistemicStatus, InterventionDecision, SessionBundle, ThoughtNode, ThoughtPhase, ThoughtStatePatch } from "./types";
import { interventionDecisionSchema, userActionSchema } from "./schemas";

const keyword = (text: string, words: string[]) => words.some((word) => text.includes(word));

export function classifyUserAction(text: string) {
  return userActionSchema.parse({
    text,
    kind: keyword(text, ["挑战", "反例", "哪里不对"]) ? "request_challenge"
      : keyword(text, ["例子", "经历", "具体"]) ? "give_example"
        : keyword(text, ["改成", "更准确", "其实"]) ? "revise_view"
          : "new_intuition",
  });
}

export function chooseIntervention(bundle: SessionBundle, requestedFunction?: CognitiveFunction | null): InterventionDecision {
  const nodes = bundle.nodes;
  const unresolved = nodes.filter((node) => node.epistemicStatus === "unresolved");
  const candidates = nodes.filter((node) => node.epistemicStatus === "ai_proposal" || node.epistemicStatus === "ai_interpretation");
  const original = nodes.find((node) => node.type === "original_expression");
  const cognitiveFunction = requestedFunction
    ?? (original === undefined ? "mirror" : candidates.length > 0 ? "reformulate" : unresolved.length > 0 ? "ground" : "clarify");
  const purpose = {
    mirror: "先确认你正在指向什么", clarify: "把一个容易混在一起的词说清楚",
    distinguish: "拆开两个可能不同的判断", ground: "把想法带回一个具体场景",
    challenge: "检查这个想法的边界或反例", extend: "看看这个想法还可能走向哪里",
    connect: "连接当前会话里已经出现的节点", reformulate: "提出一句仍待你确认的候选表达",
    facilitate: "判断下一步最值得推进的地方", record: "记录这次思想发生了什么变化",
  }[cognitiveFunction];
  const focus = unresolved[0] ?? original ?? nodes[nodes.length - 1];
  return interventionDecisionSchema.parse({
    cognitiveFunction, targetNodeIds: focus ? [focus.id] : [], purpose,
    shouldWaitForUser: true, allowMultiPerspective: false,
  });
}

export function mockIntervention(functionName: CognitiveFunction, text: string): { content: string; nodeType: ThoughtNode["type"]; epistemicStatus: EpistemicStatus; phase: ThoughtPhase } {
  const trimmed = text.trim().replace(/[。！？!?]+$/, "");
  const output = {
    mirror: "我先这样听见它：你似乎在说“" + trimmed + "”。这句话里，哪一部分最想被认真看见？",
    clarify: "这里的“" + trimmed.slice(0, 18) + "”更接近一种感受、判断，还是你希望采取的行动？",
    distinguish: "这里可能混着两件事：你经历了什么，以及你由此得出了什么判断。你想先拆开哪一件？",
    ground: "如果把它放进最近一次真实发生的场景里，具体发生了什么？",
    challenge: "如果这个想法只在某些情况下成立，最先失效的边界会在哪里？",
    extend: "如果顺着这个想法再走一步，它会要求你重新理解什么？",
    connect: "这和你前面提到的另一个念头之间，是支持、冲突，还是只是相邻？",
    reformulate: "候选表达：也许你在意的不是“" + trimmed + "”，而是它如何影响你接下来愿意做什么。准确吗？",
    facilitate: "现在最值得推进的，可能不是得出结论，而是找到一个可以继续追问的具体位置。你想从哪里开始？",
    record: "我先记下这个变化：你正在把一个模糊直觉变成可以检查的表达。接下来希望保留什么？",
  }[functionName];
  const isCandidate = functionName === "reformulate";
  return {
    content: output,
    nodeType: isCandidate ? "candidate_interpretation" : functionName === "challenge" ? "counterexample" : functionName === "ground" ? "example" : "open_question",
    epistemicStatus: isCandidate ? "ai_proposal" : "ai_interpretation",
    phase: functionName === "reformulate" ? "reformulating" : functionName === "challenge" ? "testing" : functionName === "ground" ? "grounding" : "clarifying",
  };
}

export function applyDecision(status: EpistemicStatus, action: "accept" | "partial" | "misunderstood" | "candidate" | "reject"): { epistemicStatus: EpistemicStatus; nodeType: ThoughtNode["type"] } {
  if (status !== "ai_proposal" && status !== "ai_interpretation") throw new Error("只有 AI 候选内容可以被确认");
  if (action === "accept") return { epistemicStatus: "user_accepted", nodeType: "accepted_claim" };
  if (action === "partial") return { epistemicStatus: "partially_accepted", nodeType: "revision" };
  if (action === "misunderstood" || action === "reject") return { epistemicStatus: "user_rejected", nodeType: "rejected_claim" };
  return { epistemicStatus: "ai_proposal", nodeType: "candidate_interpretation" };
}

export function makeStatePatch(userNodeId: string, assistantNodeId: string, phase: ThoughtPhase): ThoughtStatePatch {
  return { createNodes: [], updateNodes: [], createEdges: [{ sourceNodeId: userNodeId, targetNodeId: assistantNodeId, type: "clarifies" }], currentFocusNodeId: assistantNodeId, phase };
}
