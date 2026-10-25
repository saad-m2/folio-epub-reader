import { z } from "zod";

export const CLOUD_PROVIDERS = ["microsoft", "deepl"] as const;
export const CloudProviderSchema = z.enum(CLOUD_PROVIDERS);
export const TranslationProviderSchema = z.enum(["ollama", ...CLOUD_PROVIDERS]);
export type CloudProvider = z.infer<typeof CloudProviderSchema>;
export type TranslationProvider = z.infer<typeof TranslationProviderSchema>;
export const PROVIDER_LABELS: Record<TranslationProvider, string> = {
  ollama: "Local Ollama", microsoft: "Microsoft Translator", deepl: "DeepL",
};

const secret = z.string().min(1).max(512).regex(/^[^\s\x00-\x1f\x7f]+$/);
const region = z.string().min(1).max(40).regex(/^[a-z][a-z0-9-]*[a-z0-9]$/);
export const ProviderConfigurationSchema = z.discriminatedUnion("provider", [
  z.object({ provider: z.literal("microsoft"), apiKey: secret, region: region.optional() }).strict(),
  z.object({ provider: z.literal("deepl"), apiKey: secret }).strict(),
]);
// This is write-only input for the bridge. Never return a saved configuration to the renderer.
export type ProviderConfiguration = z.infer<typeof ProviderConfigurationSchema>;
export type Availability = { state: "available" | "exhausted" | "unknown"; resetAt?: number };
export type ProviderView = {
  provider: CloudProvider;
  configured: boolean;
  availability: Availability["state"];
  credentialError?: boolean;
  resetAt?: number;
};
export type TranslationProvidersView = { current: TranslationProvider | null; providers: ProviderView[] };
export type TranslationProgress = {
  phase: "idle" | "translating" | "fallback" | "complete" | "error";
  provider: TranslationProvider | null;
};
export type TranslationResult = { text: string; provider: TranslationProvider };
