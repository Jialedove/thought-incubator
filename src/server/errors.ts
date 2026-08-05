import type { ProviderErrorCode } from "@/domain/types";

export class ProviderError extends Error {
  constructor(public readonly code: ProviderErrorCode, message: string, public readonly action?: { type: string; targetId?: string }) {
    super(message);
    this.name = "ProviderError";
  }
}

export function errorPayload(error: unknown, fallback = "请求未完成") {
  if (error instanceof ProviderError) return { code: error.code, message: error.message, action: error.action };
  return { code: "CONNECTION_FAILED" as const, message: error instanceof Error ? error.message : fallback };
}
