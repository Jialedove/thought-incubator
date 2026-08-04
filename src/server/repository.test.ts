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
});
