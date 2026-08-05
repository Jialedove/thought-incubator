import type { CognitiveFunction, InterventionDecision, InterventionResult, ModelConfig, ProviderKind } from "@/domain/types";
import type { RuntimeConnection, RuntimeProvider } from "../repository";

export type ModelDescriptor = {
  modelId: string;
  displayName: string;
  capabilities: Record<string, boolean>;
};
export type ConnectionTestResult = { ok: boolean; message: string; code?: string };
export type ModelTestResult = ConnectionTestResult;
export type StreamInterventionInput = {
  provider: RuntimeProvider;
  decision: InterventionDecision;
  context: string;
  onDelta?: (value: string) => void;
  abortSignal?: AbortSignal;
};
export type ProviderAdapter = {
  kind: ProviderKind;
  testConnection(input: RuntimeConnection, abortSignal?: AbortSignal): Promise<ConnectionTestResult>;
  listModels(input: RuntimeConnection, abortSignal?: AbortSignal): Promise<ModelDescriptor[]>;
  testModel(input: RuntimeProvider, abortSignal?: AbortSignal): Promise<ModelTestResult>;
  streamIntervention(input: StreamInterventionInput): Promise<InterventionResult>;
};

export type FakeProviderAdapter = Partial<ProviderAdapter> & { kind: ProviderKind };

export type ProviderRuntimeSelection = {
  modelConfig: ModelConfig;
  cognitiveFunction?: CognitiveFunction;
};
