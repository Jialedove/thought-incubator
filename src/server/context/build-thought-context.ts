import type { InterventionDecision, SessionBundle } from "@/domain/types";
import { isOpenQuestionResolved } from "@/domain/protocol";
import { selectRelevantNodes } from "./select-relevant-nodes";

const clip = (value: string, size: number) => value.slice(0, Math.max(0, size));

export function buildThoughtContext(input: { bundle: SessionBundle; userText: string; decision: InterventionDecision; maxChars?: number }) {
  const maxChars = input.maxChars ?? 8_000;
  const nodes = selectRelevantNodes(input.bundle, input.decision.targetNodeIds, Math.max(1_000, maxChars - 1_200));
  const nodeById = new Map(input.bundle.nodes.map((node) => [node.id, node]));
  const targetIds = new Set(input.decision.targetNodeIds);
  const relations = input.bundle.edges.filter((edge) => targetIds.has(edge.sourceNodeId) || targetIds.has(edge.targetNodeId)).slice(-12).map((edge) => {
    const source = nodeById.get(edge.sourceNodeId)?.content ?? edge.sourceNodeId;
    const target = nodeById.get(edge.targetNodeId)?.content ?? edge.targetNodeId;
    return `- ${edge.type}: ${clip(source, 120)} → ${clip(target, 120)}`;
  });
  const recentEvents = input.bundle.events.slice(-8).map((event) => `- ${event.actor}/${event.speechAct ?? "record"}: ${clip(event.content, 220)}`);
  const accepted = nodes.filter((node) => node.epistemicStatus === "user_accepted").map((node) => `- ${node.content}`);
  const pending = nodes.filter((node) => node.confirmable && node.candidateReviewStatus === "pending").map((node) => `- 候选（仅供用户审阅）：${node.content}`);
  const unresolved = nodes.filter((node) => node.type === "open_question" && !isOpenQuestionResolved(input.bundle, node.id)).map((node) => `- ${node.content}`);
  const nodeLines = nodes.map((node) => `- ${node.author === "user" ? "用户" : "AI候选/介入"} · ${node.type}: ${node.content}`);
  const context = [
    `当前用户输入：${input.userText.trim()}`,
    `当前阶段：${input.bundle.session.phase}`,
    `当前认知功能：${input.decision.cognitiveFunction}；职责：${input.decision.purpose}`,
    `目标节点：${input.decision.targetNodeIds.join(", ") || "无"}`,
    `当前焦点：${input.bundle.session.currentFocusNodeId ?? "无"}`,
    "相关思想节点：", ...nodeLines,
    "目标节点关系：", ...(relations.length ? relations : ["- 无直接关系"]),
    "最近对话：", ...(recentEvents.length ? recentEvents : ["- 无历史对话"]),
    "用户已接受观点（只能作为用户观点使用）：", ...(accepted.length ? accepted : ["- 无"]),
    "待审阅候选（不能当作用户观点）：", ...(pending.length ? pending : ["- 无"]),
    "真正未解决的问题：", ...(unresolved.length ? unresolved : ["- 无"]),
  ].join("\n");
  return context.length <= maxChars ? context : context.slice(0, maxChars);
}
