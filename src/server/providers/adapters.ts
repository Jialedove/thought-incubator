import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { Output, streamText } from "ai";
import { interventionResultSchema } from "@/domain/schemas";
import { normalizeIntervention, mockIntervention } from "@/domain/protocol";
import { ProviderError } from "../errors";
import { fetchJson, anthropicModels, googleModels, openAiModels } from "./http";
import type { ConnectionTestResult, FakeProviderAdapter, ModelDescriptor, ProviderAdapter, StreamInterventionInput } from "./types";
import type { RuntimeConnection, RuntimeProvider } from "../repository";

function sanitizeError(error: unknown) {
  const message = error instanceof Error ? error.message : "模型请求失败";
  return message.replace(/(authorization|api[-_ ]?key|token|secret)(\s*[:=]\s*)\S+/gi, "$1$2[已脱敏]").replace(/\b(?:sk|key|token|secret)[-_][A-Za-z0-9_-]+/gi, "[已脱敏]").slice(0, 500);
}

function headers(provider: RuntimeConnection) {
  return provider.apiKey ? { ...provider.headers, Authorization: `Bearer ${provider.apiKey}` } : provider.headers;
}

function openAiBase(provider: RuntimeConnection) {
  const configured = provider.baseUrl?.replace(/\/+$/, "");
  return configured || "https://api.openai.com/v1";
}

function createLanguageModel(provider: RuntimeProvider) {
  const options = { apiKey: provider.apiKey, headers: provider.headers };
  if (provider.kind === "anthropic") return createAnthropic(options)(provider.modelId ?? "");
  if (provider.kind === "google") return createGoogleGenerativeAI(options)(provider.modelId ?? "");
  return createOpenAI({ ...options, baseURL: provider.baseUrl ?? undefined })(provider.modelId ?? "");
}

async function textTest(provider: RuntimeProvider, abortSignal?: AbortSignal): Promise<ConnectionTestResult> {
  try {
    const result = streamText({ model: createLanguageModel(provider), prompt: "Return only OK.", maxOutputTokens: 5, maxRetries: 0, timeout: 15_000, abortSignal });
    const text = await result.text;
    return text.trim() ? { ok: true, message: "连接成功" } : { ok: false, message: "模型返回空内容", code: "CONNECTION_FAILED" };
  } catch (error) {
    if (abortSignal?.aborted) return { ok: false, message: "请求已停止", code: "REQUEST_ABORTED" };
    return { ok: false, message: sanitizeError(error), code: "CONNECTION_FAILED" };
  }
}

function realStream(input: StreamInterventionInput): Promise<ReturnType<typeof interventionResultSchema.parse>> {
  const { provider, decision, context, onDelta, abortSignal } = input;
  if (!provider.modelId) throw new ProviderError("MODEL_NOT_FOUND", "当前模型没有 Model ID");
  return (async () => {
    const result = streamText({
      model: createLanguageModel(provider),
      system: "你是思想孵化器中的单一认知功能。用户始终是思想作者。只输出符合 schema 的结构化介入，message 使用简体中文，保持简短，不替用户下结论。只有真正的候选解释、重述或主张使用 candidate_claim 且 confirmable=true；普通问题、镜像、区分、记录必须 confirmable=false。不要把 AI 总结写成用户原话。",
      prompt: context,
      output: Output.object({ schema: interventionResultSchema, name: "intervention_result", description: "一次等待用户回应的最小认知介入" }),
      maxOutputTokens: 700, temperature: 0.35, maxRetries: 1, timeout: 45_000, abortSignal,
    });
    let previous = "";
    for await (const partial of result.partialOutputStream) {
      const message = typeof partial?.message === "string" ? partial.message : "";
      if (message.startsWith(previous)) { onDelta?.(message.slice(previous.length)); previous = message; } else if (message) { onDelta?.(message); previous = message; }
    }
    try { return normalizeIntervention(await result.output, decision.cognitiveFunction, decision.targetNodeIds); }
    catch (error) { throw new ProviderError("INVALID_MODEL_OUTPUT", "模型输出无法验证：" + sanitizeError(error)); }
  })();
}

function withHeaders(provider: RuntimeConnection, extra: Record<string, string> = {}) {
  return { ...provider.headers, ...extra };
}

const defaultAdapters: ProviderAdapter[] = [
  {
    kind: "mock",
    async testConnection() { return { ok: true, message: "演示模式已就绪，不访问外部网络" }; },
    async listModels() { return [{ modelId: "demo", displayName: "本地演示模型", capabilities: { structuredOutput: true, text: true } }]; },
    async testModel() { return { ok: true, message: "演示模型已就绪" }; },
    async streamIntervention({ decision, context, onDelta, abortSignal }) {
      const text = context.match(/当前用户输入：([\s\S]*?)(?:\n|$)/)?.[1] ?? context;
      const result = mockIntervention(decision.cognitiveFunction, text);
      for (const chunk of result.message.match(/.{1,12}/gu) ?? [result.message]) { if (abortSignal?.aborted) throw new ProviderError("REQUEST_ABORTED", "请求已停止"); onDelta?.(chunk); await Promise.resolve(); }
      return result;
    },
  },
  {
    kind: "openai",
    async testConnection(provider, signal) { const models = await this.listModels(provider, signal); return models.length ? { ok: true, message: "连接成功" } : { ok: false, message: "没有发现可用模型", code: "MODEL_NOT_FOUND_REMOTE" }; },
    async listModels(provider, signal) { return openAiModels(await fetchJson(`${openAiBase(provider)}/models`, { headers: headers(provider), signal }, "OpenAI")); },
    async testModel(provider, signal) { return textTest(provider, signal); },
    streamIntervention: realStream,
  },
  {
    kind: "openai-compatible",
    async testConnection(provider, signal) { const models = await this.listModels(provider, signal); return models.length ? { ok: true, message: "连接成功" } : { ok: false, message: "没有发现可用模型", code: "MODEL_NOT_FOUND_REMOTE" }; },
    async listModels(provider, signal) { return openAiModels(await fetchJson(`${openAiBase(provider)}/models`, { headers: headers(provider), signal }, "OpenAI-compatible")); },
    async testModel(provider, signal) { return textTest(provider, signal); },
    streamIntervention: realStream,
  },
  {
    kind: "anthropic",
    async testConnection(provider, signal) { const models = await this.listModels(provider, signal); return models.length ? { ok: true, message: "连接成功" } : { ok: false, message: "没有发现可用模型", code: "MODEL_NOT_FOUND_REMOTE" }; },
    async listModels(provider, signal) { return anthropicModels(await fetchJson("https://api.anthropic.com/v1/models", { headers: withHeaders(provider, { "x-api-key": provider.apiKey, "anthropic-version": "2023-06-01" }), signal }, "Anthropic")); },
    async testModel(provider, signal) { return textTest(provider, signal); },
    streamIntervention: realStream,
  },
  {
    kind: "google",
    async testConnection(provider, signal) { const models = await this.listModels(provider, signal); return models.length ? { ok: true, message: "连接成功" } : { ok: false, message: "没有发现可用模型", code: "MODEL_NOT_FOUND_REMOTE" }; },
    async listModels(provider, signal) { return googleModels(await fetchJson(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(provider.apiKey)}`, { headers: provider.headers, signal }, "Google Generative AI")); },
    async testModel(provider, signal) { return textTest(provider, signal); },
    streamIntervention: realStream,
  },
];

const adapters = new Map(defaultAdapters.map((adapter) => [adapter.kind, adapter]));
export function setProviderAdapter(adapter: FakeProviderAdapter) {
  const original = adapters.get(adapter.kind);
  const merged = { ...original, ...adapter } as ProviderAdapter;
  adapters.set(adapter.kind, merged);
  return () => { if (original) adapters.set(adapter.kind, original); else adapters.delete(adapter.kind); };
}
export function getProviderAdapter(kind: ProviderAdapter["kind"]) { return adapters.get(kind) ?? adapters.get("openai-compatible")!; }
export function streamWithAdapter(input: StreamInterventionInput) { return getProviderAdapter(input.provider.kind).streamIntervention(input); }
export function adapterFor(kind: ProviderAdapter["kind"]) { return getProviderAdapter(kind); }
