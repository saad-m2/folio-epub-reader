export function cloudTranslationMessage(code: string): string {
  switch (code) {
    case "MODEL_TIMEOUT":
    case "MODEL_SERVICE_ERROR":
    case "MODEL_INTERRUPTED":
    case "MODEL_MISSING":
    case "MODEL_OUT_OF_MEMORY":
    case "MODEL_CANCELLED":
      return "Could not finish unloading the local model. The translation service was not changed. Check Ollama, then try switching again.";
    case "CLOUD_EXHAUSTED": return "No connected cloud allowance is available. Check availability in Settings, or choose another provider.";
    case "CLOUD_RATE_LIMITED": return "The provider is temporarily limiting requests. Wait, then retry or choose another provider in Settings.";
    case "CLOUD_AUTHENTICATION": return "The provider could not authorize this request. Check your credentials and account permissions in Settings.";
    case "CLOUD_NETWORK": return "The cloud provider could not be reached. Check your connection, then retry or choose another provider in Settings.";
    case "CLOUD_TIMEOUT": return "The cloud provider took too long. Retry or choose another provider in Settings.";
    case "CLOUD_CANCELLED": return "This translation was cancelled. Select the text again to translate it.";
    case "CLOUD_INVALID_OUTPUT": return "The provider did not return usable text. You can retry or choose another provider in Settings.";
    case "CLOUD_SERVICE_ERROR": return "The provider responded in a way Leaf could not interpret. Retry or run Check availability in Settings.";
    case "CLOUD_NOT_CONFIGURED": return "Choose a configured translation provider in Settings before translating.";
    case "CLOUD_STORAGE": return "Saved credentials could not be protected or opened on this device. Check your provider settings and try again.";
    case "CLOUD_INVALID_REQUEST": return "Check the provider details and selection size, then try again.";
    default: return "The cloud request could not finish. Retry or check the provider in Settings.";
  }
}
