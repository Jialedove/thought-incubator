import { describe, expect, it } from "vitest";
import { applyDecision, chooseIntervention, classifyUserAction, mockIntervention } from "./protocol";
import type { SessionBundle } from "./types";

const emptyBundle: SessionBundle = {
  session: { id: "s", title: "x", originalIntent: null, currentFocusNodeId: null, phase: "expressing", status: "active", createdAt: 0, updatedAt: 0 },
  nodes: [], edges: [], events: [],
};

describe("思想孵化协议", () => {
  it("校验并分类用户动作", () => {
    expect(classifyUserAction("我想看看这个想法的反例").kind).toBe("request_challenge");
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
  it("Mock Provider 返回短介入且不假装是用户观点", () => {
    const result = mockIntervention("reformulate", "我不知道该怎么开始");
    expect(result.epistemicStatus).toBe("ai_proposal");
    expect(result.content).toContain("候选表达");
  });
});
