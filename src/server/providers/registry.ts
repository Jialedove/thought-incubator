import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { Output, streamText } from "ai";
import { interventionResultSchema } from "@/domain/schemas";
import { normalizeIntervention } from "@/domain/protocol";
import type { InterventionDecision } from "@/domain/types";
import { getProviderForFunction, getProviderSecret, type RuntimeProvider } from "../repository";

export { getProviderForFunction };

function sanitizeError(error: unknown) {
  const message = error instanceof Error ? error.message : "模型请求失败";
  return message
    .replace(/(authorization|api[-_ ]?key|token|secret)(\s*[:=]\s*)\S+/gi, "$1$2[已脱敏]")
    .replace(/\b(?:sk|key|token|secret)[-_][A-Za-z0-9_-]+/gi, "[已脱敏]")
    .slice(0, 500);
}

export function createLanguageModel(provider: RuntimeProvider) {
  const options = { apiKey: provider.apiKey, headers: provider.headers };
  if (provider.kind === "anthropic") return createAnthropic(options)(provider.modelId ?? "");
  if (provider.kind === "google") return createGoogleGenerativeAI(options)(provider.modelId ?? "");
  return createOpenAI({ ...options, baseURL: provider.baseUrl ?? undefined })(provider.modelId ?? "");
}

export async function streamIntervention(provider: RuntimeProvider, decision: InterventionDecision, userText: string, onDelta?: (value: string) => void, abortSignal?: AbortSignal) {
  if (!provider.modelId) throw new Error("当前供应商没有可用的 Model ID");
  const result = streamText({
    model: createLanguageModel(provider),
    system: "你是思想孵化器中的单一认知功能。用户始终是思想作者。只输出符合 schema 的结构化介入，message 使用简体中文，保持简短，不替用户下结论。只有真正的候选解释、重述或主张使用 candidate_claim 且 confirmable=true；普通问题、镜像、区分、记录必须 confirmable=false 且不要 proposedNode。问题不要伪装成 counterexample；若只是提问，使用 speechAct=question、proposedNode.type=open_question 或省略 proposedNode。",
    prompt: JSON.stringify({ function: decision.cognitiveFunction, purpose: decision.purpose, targetNodeIds: decision.targetNodeIds, userText }),
    output: Output.object({ schema: interventionResultSchema, name: "intervention_result", description: "一次等待用户回应的最小认知介入" }),
    maxOutputTokens: 700,
    temperature: 0.35,
    maxRetries: 1,
    timeout: 45_000,
    abortSignal,
  });
  let previous = "";
  for await (const partial of result.partialOutputStream) {
    const message = typeof partial?.message === "string" ? partial.message : "";
    if (message.startsWith(previous)) {
      onDelta?.(message.slice(previous.length));
      previous = message;
    } else if (message) {
      onDelta?.(message);
      previous = message;
    }
  }
  try {
    return normalizeIntervention(await result.output, decision.cognitiveFunction, decision.targetNodeIds);
  } catch (error) {
    throw new Error("模型输出无法验证：" + sanitizeError(error));
  }
}

export async function testProviderConnection(providerId: string, abortSignal?: AbortSignal) {
  const provider = getProviderSecret(providerId);
  if (!provider) return { ok: false, message: "供应商不存在或已停用" };
  if (provider.kind === "mock") return { ok: true, message: "演示模式已就绪，不访问外部网络" };
  if (!provider.apiKey || !provider.modelId) return { ok: false, message: "请填写 API Key 和 Model ID" };
  try {
    const result = streamText({ model: createLanguageModel(provider), prompt: "Return only OK.", maxOutputTokens: 5, maxRetries: 0, timeout: 15_000, abortSignal });
    const text = await result.text;
    return { ok: Boolean(text.trim()), message: text.trim() ? "连接成功" : "模型返回空内容" };
  } catch (error) {
    return { ok: false, message: sanitizeError(error) };
  }
}
