import { describe, expect, it } from "vitest";
import { buildThoughtContext } from "./build-thought-context";
import type { SessionBundle } from "@/domain/types";

const bundle: SessionBundle = {
  session: { id: "s", title: "测试", originalIntent: "原始念头", currentFocusNodeId: "q", phase: "clarifying", status: "active", createdAt: 1, updatedAt: 2 },
  nodes: [
    { id: "original", sessionId: "s", type: "original_expression", content: "用户自己的原始表达", author: "user", epistemicStatus: "user_original", parentNodeId: null, sourceEventIds: [], speechAct: "record", confirmable: false, candidateReviewStatus: null, provenanceNodeId: null, createdAt: 1, updatedAt: 1 },
    { id: "q", sessionId: "s", type: "open_question", content: "真正的问题是什么？", author: "system", epistemicStatus: "unresolved", parentNodeId: "original", sourceEventIds: [], speechAct: "question", confirmable: false, candidateReviewStatus: null, provenanceNodeId: null, createdAt: 2, updatedAt: 2 },
  ], edges: [], events: [], runs: [],
};

describe("ThoughtContextBuilder", () => {
  it("保留用户输入、目标、未解决问题，并遵守预算", () => {
    const context = buildThoughtContext({ bundle, userText: "我的新输入", decision: { cognitiveFunction: "clarify", targetNodeIds: ["q"], purpose: "澄清", shouldWaitForUser: true, allowMultiPerspective: false }, maxChars: 500 });
    expect(context).toContain("当前用户输入：我的新输入");
    expect(context).toContain("真正未解决的问题");
    expect(context.length).toBeLessThanOrEqual(500);
  });
});
