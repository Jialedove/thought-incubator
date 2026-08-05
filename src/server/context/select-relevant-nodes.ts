import { isOpenQuestionResolved } from "@/domain/protocol";
import type { SessionBundle, ThoughtNode } from "@/domain/types";

export function selectRelevantNodes(bundle: SessionBundle, targetNodeIds: string[] = [], maxChars = 6_000): ThoughtNode[] {
  const focusId = bundle.session.currentFocusNodeId;
  const targetSet = new Set(targetNodeIds);
  const priority = (node: ThoughtNode) => {
    if (targetSet.has(node.id)) return 0;
    if (node.id === focusId) return 1;
    if (node.type === "original_expression" && node.author === "user") return 2;
    if (node.epistemicStatus === "user_accepted") return 3;
    if (node.confirmable && node.candidateReviewStatus === "pending") return 4;
    if (node.type === "open_question" && !isOpenQuestionResolved(bundle, node.id)) return 5;
    return 6;
  };
  const selected = [...bundle.nodes].sort((a, b) => priority(a) - priority(b) || b.updatedAt - a.updatedAt);
  const result: ThoughtNode[] = [];
  let used = 0;
  for (const node of selected) {
    const content = node.content.trim();
    if (!content) continue;
    const remaining = maxChars - used;
    if (remaining <= 0) break;
    const clipped = content.slice(0, Math.max(0, remaining));
    if (!clipped) break;
    result.push({ ...node, content: clipped });
    used += clipped.length;
  }
  return result;
}
