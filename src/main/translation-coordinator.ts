import { limits } from "../shared/contracts";
import { CLOUD_PROVIDERS, type CloudProvider, type ProviderConfiguration, type TranslationProgress, type TranslationProvider, type TranslationProvidersView, type TranslationResult } from "../shared/translation";
import { CloudTranslationFailure, type CloudAdapters } from "./cloud-translation-types";
import { TranslationFailure, type LocalTranslationGateway } from "./translation";
import type { TranslationStore } from "./translation-store";

type Operation = { epoch: number; controller: AbortController };

export class TranslationCoordinator {
  private epoch = 0;
  private active: Operation | undefined;
  private readonly checks = new Map<CloudProvider, AbortController>();
  private progress: TranslationProgress = { phase: "idle", provider: null };

  constructor(private readonly store: TranslationStore, private readonly adapters: CloudAdapters, private readonly local: Pick<LocalTranslationGateway, "translate" | "cancelActiveTranslation" | "unload">) {}

  getProviders(): TranslationProvidersView { return this.store.getView(); }
  getProgress(): TranslationProgress { return { ...this.progress }; }

  saveProvider(configuration: ProviderConfiguration): TranslationProvidersView {
    this.invalidateConfiguration();
    this.store.saveConfiguration(configuration);
    return this.getProviders();
  }

  removeProvider(provider: CloudProvider): TranslationProvidersView {
    this.invalidateConfiguration();
    this.store.removeConfiguration(provider);
    return this.getProviders();
  }

  async setProvider(provider: TranslationProvider): Promise<TranslationProvidersView> {
    this.invalidateConfiguration();
    const epoch = this.epoch;
    if (provider !== "ollama" && this.store.getCurrent() === "ollama") {
      // Validate the destination before releasing the local model. The gateway
      // queues unloading after any pending Load and cancels local generation.
      if (!this.store.getConfiguration(provider)) throw new CloudTranslationFailure("not_configured");
      try {
        const status = await this.local.unload();
        if (status.state === "loaded" || status.state === "loading" || status.state === "unloading" || status.state === "error") throw new TranslationFailure("service_error");
      } catch (error) {
        // A stopped/uninstalled runtime must not prevent choosing cloud.
        if (!(error instanceof TranslationFailure) || error.code !== "unavailable") throw error;
      }
      if (epoch !== this.epoch) throw new CloudTranslationFailure("cancelled");
    }
    this.store.setCurrent(provider);
    return this.getProviders();
  }

  async checkAvailability(provider: CloudProvider): Promise<TranslationProvidersView> {
    const configuration = this.store.getConfiguration(provider);
    if (!configuration) throw new CloudTranslationFailure("not_configured");
    this.cancel();
    this.checks.get(provider)?.abort();
    const controller = new AbortController();
    this.checks.set(provider, controller);
    try {
      const availability = await this.adapters[provider].checkAvailability(configuration, controller.signal);
      if (controller.signal.aborted || this.checks.get(provider) !== controller) throw new CloudTranslationFailure("cancelled");
      // Unknown is not evidence that a previously exhausted allowance recovered.
      if (availability.state !== "unknown" || this.store.getAvailability(provider).state !== "exhausted") this.store.setAvailability(provider, availability);
      return this.getProviders();
    } catch (error) {
      if (controller.signal.aborted) throw new CloudTranslationFailure("cancelled");
      throw error instanceof CloudTranslationFailure ? error : new CloudTranslationFailure("service_error");
    } finally {
      if (this.checks.get(provider) === controller) this.checks.delete(provider);
    }
  }

  async translate(text: string, valid: () => boolean = () => true): Promise<TranslationResult> {
    this.cancel();
    const operation: Operation = { epoch: this.epoch, controller: new AbortController() };
    this.active = operation;
    let provider: TranslationProvider | null = null;
    try {
      this.ensureValid(operation, valid);
      provider = this.store.getCurrent();
      if (!text.trim() || text.length > limits.maxIpcText) throw new CloudTranslationFailure("invalid_request");
      if (!provider) throw new CloudTranslationFailure("not_configured");
      if (provider === "ollama") {
        this.progress = { phase: "translating", provider };
        const result = await this.local.translate(text, operation.controller.signal);
        this.ensureValid(operation, valid);
        this.progress = { phase: "complete", provider };
        return { text: result.text, provider };
      }
      const attempted = new Set<CloudProvider>();
      let fallback = false;
      while (true) {
        this.ensureValid(operation, valid);
        const configuration = this.store.getConfiguration(provider);
        if (!configuration) throw new CloudTranslationFailure("not_configured");
        if (this.store.getAvailability(provider).state !== "exhausted") {
          attempted.add(provider);
          this.progress = { phase: fallback ? "fallback" : "translating", provider };
          try {
            const result = await this.adapters[provider].translate(text, configuration, operation.controller.signal, () => {
              this.ensureValid(operation, valid);
              return true;
            });
            this.ensureValid(operation, valid);
            if (typeof result.text !== "string" || !result.text.trim() || result.text.length > 20_000) throw new CloudTranslationFailure("invalid_output");
            this.store.setAvailability(provider, { state: "available" });
            this.progress = { phase: "complete", provider };
            return { text: result.text, provider };
          } catch (error) {
            this.ensureValid(operation, valid);
            if (!(error instanceof CloudTranslationFailure)) throw new CloudTranslationFailure("service_error");
            if (error.code !== "exhausted") throw error;
            this.store.setAvailability(provider, { state: "exhausted", ...(error.resetAt !== undefined ? { resetAt: error.resetAt } : {}) });
          }
        }
        this.ensureValid(operation, valid);
        const next = CLOUD_PROVIDERS.find(candidate => !attempted.has(candidate) && this.store.getAvailability(candidate).state !== "exhausted" && !!this.store.getConfiguration(candidate));
        if (!next) throw new CloudTranslationFailure("exhausted");
        this.ensureValid(operation, valid);
        this.store.setCurrent(next);
        provider = next;
        fallback = true;
        this.progress = { phase: "fallback", provider };
      }
    } catch (error) {
      // Superseded completions cannot overwrite a newer operation's progress.
      if (this.active === operation) this.progress = { phase: "error", provider };
      if (operation.controller.signal.aborted || operation.epoch !== this.epoch || !valid()) throw new CloudTranslationFailure("cancelled");
      throw error;
    } finally {
      if (this.active === operation) this.active = undefined;
    }
  }

  cancel(): void {
    this.epoch += 1;
    this.active?.controller.abort();
    this.active = undefined;
    this.local.cancelActiveTranslation();
    for (const controller of this.checks.values()) controller.abort();
    this.checks.clear();
    this.progress = { phase: "idle", provider: null };
  }

  private invalidateConfiguration(): void {
    this.cancel();
  }

  private ensureValid(operation: Operation, valid: () => boolean): void {
    if (operation.epoch !== this.epoch || operation.controller.signal.aborted || !valid()) {
      operation.controller.abort();
      throw new CloudTranslationFailure("cancelled");
    }
  }
}
