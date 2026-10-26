import { createHash, createHmac } from "node:crypto";
import { limits } from "../shared/contracts";
import { ProviderConfigurationSchema, type Availability, type ProviderConfiguration } from "../shared/translation";
import { CloudTranslationFailure, type CloudAdapters, type CloudFailureCode } from "./cloud-translation-types";

const MAX_RESPONSE_BYTES = 256 * 1024;
const MAX_OUTPUT_CHARACTERS = 20_000;
const MICROSOFT_URL = "https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&from=de&to=en&textType=plain";
// A Check availability action may send this fixed phrase, never the registered selection.
export const MICROSOFT_AVAILABILITY_PHRASE = "Guten Tag.";
export const CLOUD_AVAILABILITY_PHRASE = "Guten Tag.";

type MicrosoftConfiguration = Extract<ProviderConfiguration, { provider: "microsoft" }>;
type DeepLConfiguration = Extract<ProviderConfiguration, { provider: "deepl" }>;
type ZpkConfiguration = Extract<ProviderConfiguration, { provider: "zpk" }>;
type LaraConfiguration = Extract<ProviderConfiguration, { provider: "lara" }>;
type TraduckConfiguration = Extract<ProviderConfiguration, { provider: "traduck" }>;
type JsonObject = Record<string, unknown>;
type Reply = { status: number; data: unknown };
type Options = { fetcher?: typeof fetch; timeoutMs?: number };

const object = (value: unknown): value is JsonObject => !!value && typeof value === "object" && !Array.isArray(value);
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;
const failure = (code: CloudFailureCode): never => { throw new CloudTranslationFailure(code); };
// Only this internal error authorizes the owner's fixed-probe heuristic.
class UnclearProviderFailure extends CloudTranslationFailure {
  constructor() { super("service_error"); }
}

function checkNewProviderReply(reply: Reply): JsonObject {
  if (reply.status === 401 || reply.status === 403) return failure("authentication");
  if (reply.status === 429) return failure("rate_limited");
  if (reply.status === 408 || reply.status === 504) return failure("timeout");
  if ([400, 404, 405, 413, 415, 422].includes(reply.status)) return failure("invalid_request");
  if (reply.status === 502 || reply.status === 503) return failure("service_error");
  if (reply.status < 200 || reply.status >= 300) throw new UnclearProviderFailure();
  return responseObject(reply);
}

function explicitZpkError(data: JsonObject): CloudFailureCode | undefined {
  const errors = Array.isArray(data.errors) ? data.errors : [];
  const codes = errors.filter(object).map(error => String(error.id ?? error.code ?? "").toUpperCase());
  if (codes.some(code => /^(INVALID_API_KEY|INVALID_APPLICATION_ID|AUTHENTICATION_FAILED|UNAUTHORIZED|ACCESS_DENIED)$/.test(code))) return "authentication";
  if (codes.some(code => /^(RATE_LIMITED|RATE_LIMIT_EXCEEDED|TOO_MANY_REQUESTS)$/.test(code))) return "rate_limited";
  if (codes.some(code => /^(MISSING_REQUIRED_PARAMETER|INVALID_PARAMETER|INVALID_LANGUAGE|TEXT_TOO_LONG)$/.test(code))) return "invalid_request";
  return undefined;
}

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

  async function request(url: string, init: RequestInit, signal: AbortSignal, ndjson = false): Promise<Reply> {
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
        try { data = JSON.parse(raw); } catch {
          if (ndjson) {
            try { data = raw.split(/\r?\n/).filter(line => line.trim()).map(line => JSON.parse(line)); }
            catch { data = undefined; }
          }
        }
        if (controller.signal.aborted) return failure(timedOut ? "timeout" : "cancelled");
        if (ndjson && response.ok && data !== undefined) {
          const frames: unknown[] = Array.isArray(data) ? data : [data];
          for (const frame of frames) {
            if (!object(frame)) return failure("invalid_output");
            if (typeof frame.status === "number" && (frame.status < 200 || frame.status >= 300)) return { status: frame.status, data: frame.data ?? frame };
          }
          const last = frames[frames.length - 1];
          data = object(last) ? last.data ?? last : undefined;
        }
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

  async function zpkTranslate(text: string, config: ZpkConfiguration, signal: AbortSignal) {
    const reply = await request("https://zpk.systems/api/translate/text", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ application_id: config.applicationId, api_key: config.apiKey, texts: [{ text, source_language: "de", target_languages: ["en"] }] }),
    }, signal);
    const explicit = object(reply.data) && reply.data.success === false ? explicitZpkError(reply.data) : undefined;
    if (explicit) return failure(explicit);
    const data = checkNewProviderReply(reply);
    if (data.success === false) throw new UnclearProviderFailure();
    if (data.success !== true || !Array.isArray(data.results) || data.results.length !== 1 || !object(data.results[0]) || !object(data.results[0].translations)) return failure("invalid_output");
    return output(data.results[0].translations.en);
  }

  async function laraTranslate(text: string, config: LaraConfiguration, signal: AbortSignal, isCurrent?: () => boolean) {
    // Match the official SDK's v2 access-key authentication, without its retries.
    const body = JSON.stringify({ id: config.accessKeyId });
    const date = new Date().toUTCString();
    const digest = createHash("md5").update(body).digest("base64");
    const signature = createHmac("sha256", config.accessKeySecret).update(`POST\n/v2/auth\n${digest}\napplication/json\n${date}`).digest("base64");
    const authReply = await request("https://api.laratranslate.com/v2/auth", {
      method: "POST", headers: { "content-type": "application/json", "X-Lara-Date": date, "Content-MD5": digest, authorization: `Lara:${signature}` }, body,
    }, signal);
    let auth: JsonObject;
    try { auth = checkNewProviderReply(authReply); }
    catch (error) {
      // Authentication is not a translation quota check. Do not turn an auth
      // service outage into a diagnostic translation or inferred exhaustion.
      if (error instanceof UnclearProviderFailure) return failure("service_error");
      throw error;
    }
    if (typeof auth.token !== "string" || !auth.token || auth.token.length > 16_384 || /[\s\x00-\x1f\x7f]/.test(auth.token)) return failure("invalid_output");
    if (signal.aborted || isCurrent?.() === false) return failure("cancelled");
    const data = checkNewProviderReply(await request("https://api.laratranslate.com/v2/translate", {
      method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${auth.token}`, "X-Lara-Date": new Date().toUTCString(), "X-No-Trace": "true" },
      body: JSON.stringify({ q: text, source: "de-DE", target: "en-US", content_type: "text/plain", style: "faithful", reasoning: false, use_cache: false }),
    }, signal, true));
    return output(data.translation);
  }

  async function traduckTranslate(text: string, config: TraduckConfiguration, signal: AbortSignal) {
    const reply = await request("https://traduck.com/api/v1/translate", {
      method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify({ text, source_lang: "de", target_lang: "en" }),
    }, signal);
    if (reply.status === 429 && object(reply.data) && object(reply.data.error) && reply.data.error.code === "quota_exceeded") return failure("exhausted");
    return output(checkNewProviderReply(reply).translation);
  }

  async function probeAvailability(translate: () => Promise<{ text: string }>, assumeUnclear = false): Promise<Availability> {
    try { await translate(); return { state: "available" }; }
    catch (error) {
      if ((error instanceof CloudTranslationFailure && error.code === "exhausted") || (assumeUnclear && error instanceof UnclearProviderFailure)) return { state: "exhausted" };
      throw error;
    }
  }

  async function withUnclearProbe(translate: (text: string) => Promise<{ text: string }>, text: string, signal: AbortSignal, isCurrent?: () => boolean) {
    try { return await translate(text); }
    catch (error) {
      if (!(error instanceof UnclearProviderFailure)) throw error;
      if (signal.aborted || isCurrent?.() === false) return failure("cancelled");
      const availability = await probeAvailability(() => translate(CLOUD_AVAILABILITY_PHRASE), true);
      if (availability.state === "exhausted") return failure("exhausted");
      // A successful diagnostic never replaces or resubmits the selected text.
      throw error;
    }
  }

  return {
    zpk: {
      async translate(text, value, signal, isCurrent) {
        validateText(text);
        const config = configuration(value, "zpk");
        return withUnclearProbe(phrase => zpkTranslate(phrase, config, signal), text, signal, isCurrent);
      },
      async checkAvailability(value, signal) {
        const config = configuration(value, "zpk");
        return probeAvailability(() => zpkTranslate(CLOUD_AVAILABILITY_PHRASE, config, signal), true);
      },
    },
    lara: {
      async translate(text, value, signal, isCurrent) {
        validateText(text);
        const config = configuration(value, "lara");
        return withUnclearProbe(phrase => laraTranslate(phrase, config, signal, isCurrent), text, signal, isCurrent);
      },
      async checkAvailability(value, signal) {
        const config = configuration(value, "lara");
        return probeAvailability(() => laraTranslate(CLOUD_AVAILABILITY_PHRASE, config, signal), true);
      },
    },
    traduck: {
      async translate(text, value, signal) { validateText(text); return traduckTranslate(text, configuration(value, "traduck"), signal); },
      async checkAvailability(value, signal) {
        const config = configuration(value, "traduck");
        return probeAvailability(() => traduckTranslate(CLOUD_AVAILABILITY_PHRASE, config, signal));
      },
    },
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
