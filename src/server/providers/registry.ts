import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";
import type { SafeProviderConfig } from "@/domain/types";
import { getProviderSecret } from "../repository";

export async function testProviderConnection(providerId: string) {
  const provider = getProviderSecret(providerId);
  if (!provider) return { ok: false, message: "供应商不存在或已停用" };
  if (provider.kind === "mock") return { ok: true, message: "演示模式已就绪，不访问外部网络" };
  if (!provider.apiKey || !provider.modelId) return { ok: false, message: "请填写 API Key 和 Model ID" };
  try {
    const model = createLanguageModel(provider);
    const result = await streamText({ model, prompt: "Return only OK.", maxOutputTokens: 5 });
    const text = await result.text;
    return { ok: Boolean(text.trim()), message: text.trim() ? "连接成功" : "模型返回空内容" };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message.replace(/sk-[A-Za-z0-9_-]+/g, "[已脱敏]") : "连接失败" };
  }
}

function createLanguageModel(provider: SafeProviderConfig & { apiKey: string }) {
  const options = { apiKey: provider.apiKey, headers: provider.headers };
  if (provider.kind === "anthropic") return createAnthropic(options)(provider.modelId ?? "");
  if (provider.kind === "google") return createGoogleGenerativeAI(options)(provider.modelId ?? "");
  return createOpenAI({ ...options, baseURL: provider.baseUrl ?? undefined })(provider.modelId ?? "");
}
