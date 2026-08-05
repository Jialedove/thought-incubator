import { adapterFor, getProviderAdapter, setProviderAdapter, streamWithAdapter } from "./adapters";
import type { FakeProviderAdapter, ModelDescriptor } from "./types";
import { ProviderError } from "../errors";
import { getProviderForFunction, getProviderSecret, getProviderConnection, getRuntimeProviderForModel, recordProviderTest, type RuntimeProvider } from "../repository";
import type { InterventionDecision } from "@/domain/types";

export { getProviderForFunction, getProviderAdapter, setProviderAdapter, adapterFor };
export type { FakeProviderAdapter, ModelDescriptor };

export async function streamIntervention(provider: RuntimeProvider, decision: InterventionDecision, context: string, onDelta?: (value: string) => void, abortSignal?: AbortSignal) {
  return streamWithAdapter({ provider, decision, context, onDelta, abortSignal });
}

export async function discoverModels(providerId: string, abortSignal?: AbortSignal) {
  const provider = getProviderConnection(providerId);
  if (!provider) throw new ProviderError("PROVIDER_NOT_FOUND", "供应商不存在或已停用");
  if (!provider.apiKey && provider.kind !== "mock") throw new ProviderError("CREDENTIAL_MISSING", "请先保存 API Key");
  return adapterFor(provider.kind).listModels(provider, abortSignal);
}

export async function testProviderConnection(providerId: string, modelConfigId?: string, abortSignal?: AbortSignal) {
  const connection = getProviderConnection(providerId);
  if (!connection) return { ok: false, message: "供应商不存在、已停用或凭据不可读", code: "PROVIDER_NOT_FOUND" };
  try {
    const runtime = modelConfigId ? getRuntimeProviderForModel(modelConfigId) : null;
    if (modelConfigId && (!runtime || runtime.id !== providerId)) return { ok: false, message: "模型不属于当前 Provider", code: "MODEL_NOT_FOUND" };
    const result = runtime ? await adapterFor(runtime.kind).testModel(runtime, abortSignal) : await adapterFor(connection.kind).testConnection(connection, abortSignal);
    recordProviderTest(providerId, result);
    return result;
  } catch (error) {
    const result = { ok: false, message: error instanceof Error ? error.message : "连接测试失败", code: error instanceof ProviderError ? error.code : "CONNECTION_FAILED" } as const;
    recordProviderTest(providerId, result);
    return result;
  }
}
