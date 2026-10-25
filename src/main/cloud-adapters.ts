import { limits } from "../shared/contracts";
import { ProviderConfigurationSchema, type Availability, type ProviderConfiguration } from "../shared/translation";
import { CloudTranslationFailure, type CloudAdapters, type CloudFailureCode } from "./cloud-translation-types";

const MAX_RESPONSE_BYTES = 256 * 1024;
const MAX_OUTPUT_CHARACTERS = 20_000;
const MICROSOFT_URL = "https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&from=de&to=en&textType=plain";
// A Check availability action may send this fixed phrase, never the registered selection.
export const MICROSOFT_AVAILABILITY_PHRASE = "Guten Tag.";

type MicrosoftConfiguration = Extract<ProviderConfiguration, { provider: "microsoft" }>;
type DeepLConfiguration = Extract<ProviderConfiguration, { provider: "deepl" }>;
type JsonObject = Record<string, unknown>;
type Reply = { status: number; data: unknown };
type Options = { fetcher?: typeof fetch; timeoutMs?: number };

const object = (value: unknown): value is JsonObject => !!value && typeof value === "object" && !Array.isArray(value);
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;
const failure = (code: CloudFailureCode): never => { throw new CloudTranslationFailure(code); };

function configuration<T extends ProviderConfiguration["provider"]>(value: ProviderConfiguration, provider: T): Extract<ProviderConfiguration, { provider: T }> {
  const parsed = ProviderConfigurationSchema.safeParse(value);
  if (!parsed.success || parsed.data.provider !== provider) return failure("invalid_request");
  // Provider IDs discriminate the validated union.
  return parsed.data as Extract<ProviderConfiguration, { provider: T }>;
}

function validateText(text: string): void {
  if (typeof text !== "string" || !text.trim() || text.length > limits.maxIpcText) failure("invalid_request");
}

function output(value: unknown): { text: string } {
  if (typeof value !== "string") return failure("invalid_output");
  const text = value.replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();
  if (!text || text.length > MAX_OUTPUT_CHARACTERS) return failure("invalid_output");
  return { text };
}

async function boundedResponse(response: Response, signal: AbortSignal): Promise<string> {
  const statedLength = response.headers.get("content-length");
  if (statedLength && Number(statedLength) > MAX_RESPONSE_BYTES) { void response.body?.cancel().catch(() => {}); return failure("invalid_output"); }
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  const abort = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener("abort", abort, { once: true });
  try {
    while (true) {
      if (signal.aborted) return failure("cancelled");
      const item = await reader.read();
      if (signal.aborted) return failure("cancelled");
      if (item.done) break;
      bytes += item.value.byteLength;
      if (bytes > MAX_RESPONSE_BYTES) { void reader.cancel().catch(() => {}); return failure("invalid_output"); }
      chunks.push(item.value);
    }
    try { return new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)); }
    catch { return failure("invalid_output"); }
  } finally { signal.removeEventListener("abort", abort); reader.releaseLock(); }
}

function responseObject(reply: Reply): JsonObject {
  return object(reply.data) ? reply.data : failure("invalid_output");
}

function microsoftResult(reply: Reply): { text: string } {
  if (reply.status < 200 || reply.status >= 300) {
    const code = object(reply.data) && object(reply.data.error) ? reply.data.error.code : undefined;
    if (reply.status === 403 && code === 403001) return failure("exhausted");
    if (reply.status === 401 || reply.status === 403) return failure("authentication");
    if (reply.status === 429) return failure("rate_limited");
    return failure("service_error");
  }
  if (!Array.isArray(reply.data) || reply.data.length !== 1 || !object(reply.data[0])) return failure("invalid_output");
  const translations = reply.data[0].translations;
  if (!Array.isArray(translations) || translations.length !== 1 || !object(translations[0]) || translations[0].to !== "en") return failure("invalid_output");
  return output(translations[0].text);
}

function checkDeepLReply(reply: Reply): JsonObject {
  if (reply.status === 456) return failure("exhausted");
  if (reply.status === 429 || reply.status === 529) return failure("rate_limited");
  if (reply.status === 401 || reply.status === 403) return failure("authentication");
  if (reply.status < 200 || reply.status >= 300) return failure("service_error");
  return responseObject(reply);
}

export function createCloudAdapters(options: Options = {}): CloudAdapters {
  const fetcher = options.fetcher ?? fetch;
  const timeoutMs = options.timeoutMs ?? 30_000;

  async function request(url: string, init: RequestInit, signal: AbortSignal): Promise<Reply> {
    if (signal.aborted) return failure("cancelled");
    const controller = new AbortController();
    let timedOut = false;
    let abortListener: (() => void) | undefined;
    const aborted = new Promise<never>((_resolve, reject) => {
      abortListener = () => reject(new CloudTranslationFailure(timedOut ? "timeout" : "cancelled"));
      controller.signal.addEventListener("abort", abortListener, { once: true });
    });
    const externalAbort = () => controller.abort();
    signal.addEventListener("abort", externalAbort, { once: true });
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
    try {
      const operation = async (): Promise<Reply> => {
        const response = await fetcher(url, { ...init, signal: controller.signal, redirect: "error" });
        const raw = await boundedResponse(response, controller.signal);
        let data: unknown;
        try { data = JSON.parse(raw); } catch { data = undefined; }
        if (controller.signal.aborted) return failure(timedOut ? "timeout" : "cancelled");
        return { status: response.status, data };
      };
      return await Promise.race([operation(), aborted]);
    } catch (error) {
      if (signal.aborted) return failure("cancelled");
      if (timedOut) return failure("timeout");
      if (error instanceof CloudTranslationFailure) throw error;
      return failure("network");
    } finally {
      clearTimeout(timer);
      signal.removeEventListener("abort", externalAbort);
      if (abortListener) controller.signal.removeEventListener("abort", abortListener);
    }
  }

  async function microsoftTranslate(text: string, config: MicrosoftConfiguration, signal: AbortSignal) {
    const headers: Record<string, string> = { "content-type": "application/json", "Ocp-Apim-Subscription-Key": config.apiKey };
    if (config.region) headers["Ocp-Apim-Subscription-Region"] = config.region;
    return microsoftResult(await request(MICROSOFT_URL, { method: "POST", headers, body: JSON.stringify([{ Text: text }]) }, signal));
  }

  function deepLRequest(config: DeepLConfiguration, endpoint: "translate" | "usage", text?: string): { url: string; init: RequestInit } {
    const origin = config.apiKey.endsWith(":fx") ? "https://api-free.deepl.com" : "https://api.deepl.com";
    return { url: `${origin}/v2/${endpoint}`, init: {
      method: endpoint === "usage" ? "GET" : "POST",
      headers: { "content-type": "application/json", authorization: `DeepL-Auth-Key ${config.apiKey}` },
      ...(endpoint === "translate" ? { body: JSON.stringify({ text: [text], source_lang: "DE", target_lang: "EN", preserve_formatting: true }) } : {}),
    } };
  }

  return {
    microsoft: {
      async translate(text, value, signal) { validateText(text); return microsoftTranslate(text, configuration(value, "microsoft"), signal); },
      async checkAvailability(value, signal) {
        try { await microsoftTranslate(MICROSOFT_AVAILABILITY_PHRASE, configuration(value, "microsoft"), signal); return { state: "available" }; }
        catch (error) { if (error instanceof CloudTranslationFailure && error.code === "exhausted") return { state: "exhausted" }; throw error; }
      },
    },
    deepl: {
      async translate(text, value, signal) {
        validateText(text);
        const { url, init } = deepLRequest(configuration(value, "deepl"), "translate", text);
        const data = checkDeepLReply(await request(url, init, signal));
        if (!Array.isArray(data.translations) || data.translations.length !== 1 || !object(data.translations[0])) return failure("invalid_output");
        return output(data.translations[0].text);
      },
      async checkAvailability(value, signal) {
        const { url, init } = deepLRequest(configuration(value, "deepl"), "usage");
        let data: JsonObject;
        try { data = checkDeepLReply(await request(url, init, signal)); }
        catch (error) { if (error instanceof CloudTranslationFailure && error.code === "exhausted") return { state: "exhausted" }; throw error; }
        if (!finite(data.character_count) || !finite(data.character_limit)) return { state: "unknown" };
        if (data.character_count >= data.character_limit) return { state: "exhausted" };
        const keyQuotaPresent = data.api_key_character_count !== undefined || data.api_key_character_limit !== undefined;
        if (keyQuotaPresent && (!finite(data.api_key_character_count) || !finite(data.api_key_character_limit))) return { state: "unknown" };
        if (finite(data.api_key_character_count) && finite(data.api_key_character_limit) && data.api_key_character_count >= data.api_key_character_limit) return { state: "exhausted" };
        // No calendar reset is inferred: the Developer allowance does not renew.
        return { state: "available" };
      },
    },
  };
}
