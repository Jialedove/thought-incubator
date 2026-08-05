import { describe, expect, it } from "vitest";
import { applyDecision, chooseIntervention, classifyUserAction, edgeForUserMove, mockIntervention, normalizeIntervention } from "./protocol";
import type { SessionBundle } from "./types";

const emptyBundle: SessionBundle = {
  session: { id: "s", title: "x", originalIntent: null, currentFocusNodeId: null, phase: "expressing", status: "active", createdAt: 0, updatedAt: 0 },
  nodes: [], edges: [], events: [],
};

describe("思想孵化协议", () => {
  it("校验并分类用户动作", () => {
    expect(classifyUserAction("我想看看这个想法的反例").kind).toBe("request_challenge");
    expect(classifyUserAction("请举一个具体例子").kind).toBe("request_example");
    expect(classifyUserAction("我举个最近发生的例子").kind).toBe("give_example");
    expect(classifyUserAction("其实我想修订这个说法").kind).toBe("revise_view");
    expect(classifyUserAction("请把两个念头连接起来").kind).toBe("request_connection");
    expect(classifyUserAction("换个说法").kind).toBe("request_reformulation");
    expect(classifyUserAction("给我一个临时总结").kind).toBe("request_summary");
    expect(() => classifyUserAction("")).toThrow();
  });
  it("空会话先选择镜像，且默认等待用户", () => {
    const decision = chooseIntervention(emptyBundle);
    expect(decision.cognitiveFunction).toBe("mirror");
    expect(decision.shouldWaitForUser).toBe(true);
    expect(decision.allowMultiPerspective).toBe(false);
  });
  it("候选观点只有确认后才进入用户接受状态", () => {
    expect(applyDecision("ai_proposal", "accept")).toEqual({ epistemicStatus: "user_accepted", nodeType: "accepted_claim" });
    expect(applyDecision("ai_proposal", "reject").epistemicStatus).toBe("user_rejected");
    expect(applyDecision("ai_proposal", "candidate").epistemicStatus).toBe("ai_proposal");
  });
  it("问题和镜像不会获得观点确认语义", () => {
    expect(mockIntervention("mirror", "一个念头").confirmable).toBe(false);
    expect(mockIntervention("ground", "一个念头").proposedNode?.type).toBe("open_question");
    expect(mockIntervention("challenge", "一个念头").proposedNode?.type).toBe("open_question");
    expect(mockIntervention("challenge", "一个念头").confirmable).toBe(false);
  });
  it("动作关系使用真实边而不是自环", () => {
    expect(edgeForUserMove("answer_question")).toBe("answers");
    expect(edgeForUserMove("give_example")).toBe("provides_example_for");
    expect(edgeForUserMove("correct_candidate")).toBe("corrects");
  });
  it("模型结果必须符合候选语义规则", () => {
    const result = mockIntervention("reformulate", "我不知道该怎么开始");
    expect(normalizeIntervention(result, "reformulate", ["n1"]).targetNodeIds).toEqual(["n1"]);
    expect(() => normalizeIntervention({ ...result, speechAct: "question", confirmable: true }, "reformulate", [])).toThrow();
  });
  it("Mock Provider 返回短介入且不假装是用户观点", () => {
    const result = mockIntervention("reformulate", "我不知道该怎么开始");
    expect(result.proposedNode?.epistemicStatus).toBe("ai_proposal");
    expect(result.message).toContain("候选表达");
    expect(result.confirmable).toBe(true);
  });
});
