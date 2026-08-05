import { ProviderError } from "../errors";
import type { ModelDescriptor } from "./types";

export async function fetchJson(url: string, init: RequestInit, providerName: string) {
  const response = await fetch(url, init);
  const body = await response.text();
  let data: unknown = {};
  try { data = body ? JSON.parse(body) : {}; } catch { /* provider errors may not be JSON */ }
  if (!response.ok) throw new ProviderError("CONNECTION_FAILED", `${providerName} 请求失败（HTTP ${response.status}）`);
  return data as Record<string, unknown>;
}

export function openAiModels(data: Record<string, unknown>): ModelDescriptor[] {
  const items = Array.isArray(data.data) ? data.data : [];
  return items.flatMap((item) => {
    if (!item || typeof item !== "object" || typeof (item as { id?: unknown }).id !== "string") return [];
    const id = (item as { id: string }).id;
    return [{ modelId: id, displayName: id, capabilities: { text: true } }];
  });
}

export function anthropicModels(data: Record<string, unknown>): ModelDescriptor[] {
  const items = Array.isArray(data.data) ? data.data : [];
  return items.flatMap((item) => {
    if (!item || typeof item !== "object" || typeof (item as { id?: unknown }).id !== "string") return [];
    const value = item as { id: string; display_name?: string };
    return [{ modelId: value.id, displayName: value.display_name ?? value.id, capabilities: { text: true } }];
  });
}

export function googleModels(data: Record<string, unknown>): ModelDescriptor[] {
  const items = Array.isArray(data.models) ? data.models : [];
  return items.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const value = item as { name?: unknown; displayName?: unknown; supportedGenerationMethods?: unknown };
    if (typeof value.name !== "string") return [];
    const modelId = value.name.replace(/^models\//, "");
    const supported = Array.isArray(value.supportedGenerationMethods) ? value.supportedGenerationMethods : [];
    if (supported.length && !supported.includes("generateContent")) return [];
    return [{ modelId, displayName: typeof value.displayName === "string" ? value.displayName : modelId, capabilities: { text: true } }];
  });
}
