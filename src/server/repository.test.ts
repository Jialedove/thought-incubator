import { afterAll, beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const databasePath = path.join(os.tmpdir(), `thought-incubator-${process.pid}.db`);
let repository: typeof import("./repository");

beforeAll(async () => {
  fs.rmSync(databasePath, { force: true });
  process.env.DATABASE_PATH = databasePath;
  repository = await import("./repository");
});
afterAll(() => { fs.rmSync(databasePath, { force: true }); });

describe("repository phase 2 integration", () => {
  it("保存连续回合、候选 provenance、决策关系并保护 session 归属", () => {
    const session = repository.createSession();
    repository.appendTurn(session.id, "我总觉得做得越多反而越没有前进");
    const candidateTurn = repository.appendTurn(session.id, "请换个说法重述这个念头");
    const candidate = candidateTurn.bundle.nodes.find((node) => node.confirmable);
    expect(candidate).toBeDefined();
    if (!candidate) return;
    const secondSession = repository.createSession();
    expect(() => repository.decideNode(secondSession.id, candidate.id, "accept")).toThrow(/不属于当前会话/);
    const decided = repository.decideNode(session.id, candidate.id, "partial", "我想表达的是行动没有形成推进");
    const revision = decided?.nodes.find((node) => node.provenanceNodeId === candidate.id);
    expect(revision?.author).toBe("user");
    expect(decided?.edges.some((edge) => edge.type === "partially_accepts" && edge.sourceNodeId !== edge.targetNodeId)).toBe(true);
  });

  it("JSON 导入校验 schemaVersion 并在冲突时生成新 ID", () => {
    const session = repository.createSession("可导出思想");
    const source = repository.appendTurn(session.id, "一个需要导入的念头").bundle;
    const imported = repository.importBundle({ schemaVersion: 2, ...source });
    expect(imported?.session.id).not.toBe(source.session.id);
    expect(imported?.nodes).toHaveLength(source.nodes.length);
    expect(imported?.edges).toHaveLength(source.edges.length);
    expect(() => repository.importBundle({ ...source, schemaVersion: 1 })).toThrow();
  });

  it("Provider 列表只返回掩码，运行时才读取秘密 Header", () => {
    const saved = repository.saveProvider({ name: "测试供应商", kind: "mock", modelId: "demo", headers: { Authorization: "header-secret" }, enabled: true, isDefault: true });
    const listed = repository.listProviders().find((provider) => provider.id === saved.id);
    expect(listed?.headers.Authorization).not.toBe("header-secret");
    expect(repository.getProviderSecret(saved.id)?.headers.Authorization).toBe("header-secret");
  });

  it("显式认知功能绑定必须解析到指定 Provider，而不是静默 Mock", () => {
    const provider = repository.saveProvider({ name: "真实测试 Provider", kind: "openai", modelId: "gpt-test", apiKey: "test-key", headers: {}, enabled: true, isDefault: false });
    repository.saveFunctionModel("challenge", provider.id, "gpt-test");
    expect(repository.getProviderForFunction("challenge").id).toBe(provider.id);
  });

  it("候选决定后关闭候选操作并拒绝重复决定", () => {
    const session = repository.createSession("候选审阅");
    repository.appendTurn(session.id, "我想把一个念头说清楚");
    const candidate = repository.appendTurn(session.id, "请换个说法").bundle.nodes.find((node) => node.confirmable);
    expect(candidate).toBeDefined();
    if (!candidate) return;
    const decided = repository.decideNode(session.id, candidate.id, "accept");
    const stored = decided?.nodes.find((node) => node.id === candidate.id);
    expect(stored?.confirmable).toBe(false);
    expect(() => repository.decideNode(session.id, candidate.id, "accept")).toThrow();
  });

  it("部分接受的修订不能因后续介入再次写入同一用户内容", () => {
    const session = repository.createSession("原子修订");
    repository.appendTurn(session.id, "我一直在重复同一个选择");
    const candidate = repository.appendTurn(session.id, "请换个说法").bundle.nodes.find((node) => node.confirmable);
    expect(candidate).toBeDefined();
    if (!candidate) return;
    const note = "我想表达的是我害怕承担选择的后果";
    const decided = repository.decideNode(session.id, candidate.id, "partial", note);
    expect(decided?.nodes.filter((node) => node.content === note)).toHaveLength(1);
    const next = repository.appendTurn(session.id, note);
    expect(next.bundle.nodes.filter((node) => node.content === note)).toHaveLength(1);
  });

  it("自然语言确认进入 Decision Service，不新增重复用户节点", async () => {
    const session = repository.createSession("自然语言决定");
    repository.appendTurn(session.id, "我想把一个念头说清楚");
    const candidate = repository.appendTurn(session.id, "请换个说法").bundle.nodes.find((node) => node.confirmable);
    expect(candidate).toBeDefined();
    if (!candidate) return;
    const result = await repository.streamTurn(session.id, "我接受这个候选表达", null, {}, undefined, "mock", "decision-test");
    expect(result.bundle.nodes.find((node) => node.id === candidate.id)?.candidateReviewStatus).toBe("accepted");
    expect(result.bundle.nodes.filter((node) => node.content === "我接受这个候选表达")).toHaveLength(0);
  });

  it("凭据支持保留与清除，模型保持按 Provider 唯一", () => {
    const provider = repository.saveProvider({ name: "凭据语义", kind: "openai", apiKey: "secret-key-1234", headers: {}, enabled: true });
    const model = repository.saveModel({ providerId: provider.id, modelId: "one", displayName: "One", enabled: true, isDefault: true, source: "manual" });
    const kept = repository.saveProvider({ id: provider.id, name: provider.name, kind: provider.kind, headers: {}, enabled: true, credentialAction: "keep" });
    expect(repository.getProviderSecret(provider.id)?.apiKey).toBe("secret-key-1234");
    expect(kept.modelId).toBe(model.modelId);
    expect(() => repository.saveModel({ providerId: provider.id, modelId: "one", displayName: "Duplicate", enabled: true, isDefault: false, source: "manual" })).toThrow(/DUPLICATE_MODEL/);
    repository.saveProvider({ id: provider.id, name: provider.name, kind: provider.kind, headers: {}, enabled: true, credentialAction: "clear" });
    expect(repository.getProviderSecret(provider.id)?.apiKey).toBe("");
  });
});
