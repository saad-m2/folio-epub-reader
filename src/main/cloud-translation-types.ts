import type { Availability, CloudProvider, ProviderConfiguration } from "../shared/translation";

export type CloudFailureCode = "exhausted" | "rate_limited" | "authentication" | "network" | "timeout" | "cancelled" | "invalid_output" | "service_error" | "invalid_request" | "storage" | "not_configured";
export class CloudTranslationFailure extends Error {
  constructor(readonly code: CloudFailureCode, readonly resetAt?: number) {
    super(code);
    this.name = "CloudTranslationFailure";
  }
}
export interface CloudTranslationAdapter {
  translate(text: string, configuration: ProviderConfiguration, signal: AbortSignal, isCurrent?: () => boolean): Promise<{ text: string }>;
  checkAvailability(configuration: ProviderConfiguration, signal: AbortSignal): Promise<Availability>;
}
export type CloudAdapters = Record<CloudProvider, CloudTranslationAdapter>;
