import { z } from "zod";
import { CLOUD_PROVIDERS, CloudProviderSchema, ProviderConfigurationSchema, TranslationProviderSchema, type Availability, type CloudProvider, type ProviderConfiguration, type TranslationProvider, type TranslationProvidersView } from "../shared/translation";
import { CloudTranslationFailure } from "./cloud-translation-types";
import type { LibraryRepository } from "./library";

export interface TranslationEncryption {
  isEncryptionAvailable(): boolean;
  encryptString(value: string): Buffer;
  decryptString(value: Buffer): string;
}

const AvailabilitySchema = z.object({ state: z.enum(["available", "exhausted", "unknown"]), resetAt: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).optional() }).strict();
const StateSchema = z.object({
  version: z.literal(2),
  current: TranslationProviderSchema.nullable(),
  providers: z.partialRecord(CloudProviderSchema, AvailabilitySchema),
}).strict();
// Only the migration accepts the retired provider; it is never an active intent,
// fallback candidate, credential configuration, or renderer-visible provider.
const LegacyStateSchema = z.object({
  version: z.literal(1),
  current: z.enum(["ollama", "microsoft", "deepl", "aws"]).nullable(),
  providers: z.object({ microsoft: AvailabilitySchema.optional(), deepl: AvailabilitySchema.optional(), aws: AvailabilitySchema.optional() }).strict(),
}).strict();
const SavedSecretSchema = z.object({ version: z.literal(1), configuration: ProviderConfigurationSchema }).strict();
type SavedState = z.infer<typeof StateSchema>;

// All methods are main-only. Credentials are encrypted before a repository write,
// and only getView() may be exposed to renderer callers.
export class TranslationStore {
  private migrated = false;
  constructor(private readonly repository: LibraryRepository, private readonly encryption: TranslationEncryption) {}

  private migrate(): void {
    if (this.migrated) return;
    this.protected(() => {
      const raw = this.repository.readTranslationState();
      if (raw !== undefined && raw.length > 4_096) throw new CloudTranslationFailure("storage");
      const parsed: unknown = raw === undefined ? undefined : JSON.parse(raw);
      const legacy = LegacyStateSchema.safeParse(parsed);
      if (legacy.success) {
        const { microsoft, deepl } = legacy.data.providers;
        const state: SavedState = {
          version: 2, current: legacy.data.current === "aws" ? null : legacy.data.current,
          providers: { ...(microsoft ? { microsoft } : {}), ...(deepl ? { deepl } : {}) },
        };
        this.repository.writeTranslationState(JSON.stringify(state), { provider: "aws", encrypted: null });
      } else {
        const state: SavedState = parsed === undefined ? { version: 2, current: "ollama", providers: {} } : StateSchema.parse(parsed);
        if (this.repository.readTranslationSecret("aws")) this.repository.writeTranslationState(JSON.stringify(state), { provider: "aws", encrypted: null });
      }
    });
    this.migrated = true;
  }

  getCurrent(): TranslationProvider | null { return this.read().current; }

  getView(): TranslationProvidersView {
    const state = this.read();
    return {
      current: state.current,
      providers: CLOUD_PROVIDERS.map(provider => {
        const configured = this.protected(() => !!this.repository.readTranslationSecret(provider));
        let credentialError = false;
        if (configured) {
          try { this.getConfiguration(provider); }
          catch { credentialError = true; }
        }
        const availability = state.providers[provider] ?? { state: "unknown" as const };
        return { provider, configured, availability: availability.state, ...(availability.resetAt !== undefined ? { resetAt: availability.resetAt } : {}), ...(credentialError ? { credentialError: true } : {}) };
      }),
    };
  }

  saveConfiguration(input: ProviderConfiguration): void {
    const parsed = ProviderConfigurationSchema.safeParse(input);
    if (!parsed.success) throw new CloudTranslationFailure("invalid_request");
    this.protected(() => {
      const state = this.read();
      if (!this.encryption.isEncryptionAvailable()) throw new CloudTranslationFailure("storage");
      const encrypted = this.encryption.encryptString(JSON.stringify({ version: 1, configuration: parsed.data }));
      if (!Buffer.isBuffer(encrypted) || !encrypted.length || encrypted.length > 32_768) throw new CloudTranslationFailure("storage");
      state.providers[parsed.data.provider] = { state: "unknown" };
      this.repository.writeTranslationState(JSON.stringify(state), { provider: parsed.data.provider, encrypted });
    });
  }

  removeConfiguration(provider: CloudProvider): void {
    this.validateProvider(provider);
    this.protected(() => {
      const state = this.read();
      delete state.providers[provider];
      if (state.current === provider) state.current = null;
      this.repository.writeTranslationState(JSON.stringify(state), { provider, encrypted: null });
    });
  }

  setCurrent(provider: TranslationProvider): void {
    if (!TranslationProviderSchema.safeParse(provider).success) throw new CloudTranslationFailure("invalid_request");
    if (provider !== "ollama" && !this.getConfiguration(provider)) throw new CloudTranslationFailure("not_configured");
    this.protected(() => {
      const state = this.read();
      state.current = provider;
      this.repository.writeTranslationState(JSON.stringify(state));
    });
  }

  getConfiguration(provider: CloudProvider): ProviderConfiguration | undefined {
    this.validateProvider(provider);
    this.migrate();
    return this.protected(() => {
      const encrypted = this.repository.readTranslationSecret(provider);
      if (!encrypted) return undefined;
      if (!this.encryption.isEncryptionAvailable() || !encrypted.length || encrypted.length > 32_768) throw new CloudTranslationFailure("storage");
      const plaintext = this.encryption.decryptString(encrypted);
      if (plaintext.length > 16_384) throw new CloudTranslationFailure("storage");
      const saved = SavedSecretSchema.parse(JSON.parse(plaintext));
      if (saved.configuration.provider !== provider) throw new CloudTranslationFailure("storage");
      return saved.configuration;
    });
  }

  getAvailability(provider: CloudProvider): Availability {
    this.validateProvider(provider);
    return this.read().providers[provider] ?? { state: "unknown" };
  }

  setAvailability(provider: CloudProvider, availability: Availability): void {
    this.validateProvider(provider);
    const parsed = AvailabilitySchema.safeParse(availability);
    if (!parsed.success) throw new CloudTranslationFailure("invalid_request");
    this.protected(() => {
      if (!this.repository.readTranslationSecret(provider)) throw new CloudTranslationFailure("not_configured");
      const state = this.read();
      state.providers[provider] = parsed.data;
      this.repository.writeTranslationState(JSON.stringify(state));
    });
  }

  private read(): SavedState {
    this.migrate();
    return this.protected(() => {
      const value = this.repository.readTranslationState();
      if (value === undefined) return { version: 2, current: "ollama", providers: {} };
      if (value.length > 4_096) throw new CloudTranslationFailure("storage");
      return StateSchema.parse(JSON.parse(value));
    });
  }

  private validateProvider(provider: CloudProvider): void {
    if (!CloudProviderSchema.safeParse(provider).success) throw new CloudTranslationFailure("invalid_request");
  }

  private protected<T>(operation: () => T): T {
    try { return operation(); }
    catch (error) { throw error instanceof CloudTranslationFailure ? error : new CloudTranslationFailure("storage"); }
  }
}
