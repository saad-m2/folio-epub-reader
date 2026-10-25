// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { createCloudAdapters, MICROSOFT_AVAILABILITY_PHRASE } from "../src/main/cloud-adapters";
import type { ProviderConfiguration } from "../src/shared/translation";

const microsoft: ProviderConfiguration = { provider: "microsoft", apiKey: "ms-test-key", region: "westeurope" };
const deepl: ProviderConfiguration = { provider: "deepl", apiKey: "deepl-test-key:fx" };
const signal = () => new AbortController().signal;
const msSuccess = () => Response.json([{ translations: [{ text: " Hello\r\nworld ", to: "en" }] }]);

function queued(...responses: Response[]) {
  return vi.fn<typeof fetch>().mockImplementation(async () => {
    const response = responses.shift();
    if (!response) throw new Error("unexpected additional request");
    return response;
  });
}

describe("Microsoft Translator", () => {
  it("sends only selected text with fixed parameters and normalizes plain text", async () => {
    const fetcher = queued(msSuccess());
    const result = await createCloudAdapters({ fetcher }).microsoft.translate("Hallo", microsoft, signal());
    expect(result).toEqual({ text: "Hello\nworld" });
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe("https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&from=de&to=en&textType=plain");
    expect(JSON.parse(String(init?.body))).toEqual([{ Text: "Hallo" }]);
    expect(init).toMatchObject({ method: "POST", redirect: "error", headers: { "Ocp-Apim-Subscription-Key": "ms-test-key", "Ocp-Apim-Subscription-Region": "westeurope" } });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it.each([
    [403, { error: { code: 403001 } }, "exhausted"],
    [403, { error: { code: 403000, message: "private service details" } }, "authentication"],
    [403, {}, "authentication"], [401, {}, "authentication"],
    [429, { error: { code: 429000 } }, "rate_limited"], [500, {}, "service_error"],
  ])("classifies HTTP %s without retries or unsafe details", async (status, data, code) => {
    const fetcher = queued(Response.json(data, { status }));
    await expect(createCloudAdapters({ fetcher }).microsoft.translate("Hallo", microsoft, signal())).rejects.toMatchObject({ code, message: code });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("availability uses only the fixed probe phrase and returns confirmed exhaustion", async () => {
    const fetcher = queued(msSuccess(), Response.json({ error: { code: 403001 } }, { status: 403 }));
    const adapter = createCloudAdapters({ fetcher }).microsoft;
    expect(await adapter.checkAvailability(microsoft, signal())).toEqual({ state: "available" });
    expect(await adapter.checkAvailability(microsoft, signal())).toEqual({ state: "exhausted" });
    for (const [, init] of fetcher.mock.calls) expect(JSON.parse(String(init?.body))).toEqual([{ Text: MICROSOFT_AVAILABILITY_PHRASE }]);
  });

  it.each([[], [{ translations: [] }], [{ translations: [{ to: "fr", text: "wrong language" }] }], [{ translations: [{ to: "en", text: " " }] }]].map(data => ({ data })))("rejects malformed probe/translation output: %j", async ({ data }) => {
    const fetcher = queued(Response.json(data));
    await expect(createCloudAdapters({ fetcher }).microsoft.checkAvailability(microsoft, signal())).rejects.toMatchObject({ code: "invalid_output" });
  });
});

describe("DeepL", () => {
  it.each(["test:fx", "test-paid-key"])("uses trusted endpoint for key %s", async apiKey => {
    const fetcher = queued(Response.json({ translations: [{ text: "Hello" }] }));
    await expect(createCloudAdapters({ fetcher }).deepl.translate("Hallo", { provider: "deepl", apiKey }, signal())).resolves.toEqual({ text: "Hello" });
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe(`https://${apiKey.endsWith(":fx") ? "api-free" : "api"}.deepl.com/v2/translate`);
    expect(JSON.parse(String(init?.body))).toEqual({ text: ["Hallo"], source_lang: "DE", target_lang: "EN", preserve_formatting: true });
    expect(init).toMatchObject({ redirect: "error", headers: { authorization: `DeepL-Auth-Key ${apiKey}` } });
  });

  it.each([[456, "exhausted"], [429, "rate_limited"], [529, "rate_limited"], [403, "authentication"], [500, "service_error"]])("classifies %s and performs no retry", async (status, code) => {
    const fetcher = queued(Response.json({ message: "private provider response" }, { status }));
    await expect(createCloudAdapters({ fetcher }).deepl.translate("Hallo", deepl, signal())).rejects.toMatchObject({ code, message: code });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it.each([
    [{ character_count: 100, character_limit: 100 }, "exhausted"],
    [{ character_count: 90, character_limit: 100 }, "available"],
    [{ character_count: 10, character_limit: 100, api_key_character_count: 5, api_key_character_limit: 5 }, "exhausted"],
    [{ character_count: 10, character_limit: 100, api_key_character_count: 0, api_key_character_limit: 0 }, "exhausted"],
    [{ character_count: 10, character_limit: 100, api_key_character_count: 4 }, "unknown"],
    [{ character_count: 10, character_limit: 100, api_key_character_count: 4, api_key_character_limit: 1_000_000_000_000 }, "available"],
    [{ character_count: 10, character_limit: 1_000_000_000_000, api_key_character_count: 4, api_key_character_limit: 1_000_000_000_000 }, "available"],
    [{ character_count: 10, character_limit: 100, api_key_character_count: 4, api_key_character_limit: -1 }, "unknown"],
    [{ character_count: -1, character_limit: 100 }, "unknown"], [{}, "unknown"],
  ])("checks account and key limits without sending text: %j", async (data, state) => {
    const fetcher = queued(Response.json(data));
    expect(await createCloudAdapters({ fetcher }).deepl.checkAvailability(deepl, signal())).toEqual({ state });
    expect(fetcher.mock.calls[0][0]).toBe("https://api-free.deepl.com/v2/usage");
    expect(fetcher.mock.calls[0][1]).toMatchObject({ method: "GET" });
    expect(fetcher.mock.calls[0][1]?.body).toBeUndefined();
  });

  it("returns exhaustion from the usage endpoint without inferring a calendar reset", async () => {
    const fetcher = queued(Response.json({}, { status: 456 }));
    expect(await createCloudAdapters({ fetcher }).deepl.checkAvailability(deepl, signal())).toEqual({ state: "exhausted" });
  });
});

describe("bounded cancellable provider transport", () => {
  it("strips controls while preserving tabs, newlines, and literal markup", async () => {
    const fetcher = queued(Response.json({ translations: [{ text: "\u0000\u0001Hi\u0008\tthere\r\n<script>plain</script>\u000b\u000c\u000e\u001f\u007f" }] }));
    await expect(createCloudAdapters({ fetcher }).deepl.translate("Hallo", deepl, signal())).resolves.toEqual({ text: "Hi\tthere\n<script>plain</script>" });
  });

  it("rejects output containing only stripped controls", async () => {
    const fetcher = queued(Response.json({ translations: [{ text: "\u0000\u0001\u0008\u000b\u000c\u000e\u001f\u007f" }] }));
    await expect(createCloudAdapters({ fetcher }).deepl.translate("Hallo", deepl, signal())).rejects.toMatchObject({ code: "invalid_output" });
  });

  it("rejects invalid configuration and oversized selections before networking", async () => {
    const fetcher = queued();
    const adapter = createCloudAdapters({ fetcher }).microsoft;
    await expect(adapter.translate("Hallo", deepl, signal())).rejects.toMatchObject({ code: "invalid_request" });
    await expect(adapter.translate("x".repeat(5001), microsoft, signal())).rejects.toMatchObject({ code: "invalid_request" });
    await expect(adapter.translate("Hallo", { ...microsoft, apiKey: "bad\nheader" }, signal())).rejects.toMatchObject({ code: "invalid_request" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("times out even if a transport never settles and ignores abort", async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(() => new Promise(() => {}));
    await expect(createCloudAdapters({ fetcher, timeoutMs: 5 }).microsoft.translate("Hallo", microsoft, signal())).rejects.toMatchObject({ code: "timeout" });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][1]?.signal?.aborted).toBe(true);
  });

  it("cancels an in-flight request without retries", async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(() => new Promise(() => {}));
    const controller = new AbortController();
    const result = createCloudAdapters({ fetcher }).microsoft.translate("Hallo", microsoft, controller.signal);
    controller.abort();
    await expect(result).rejects.toMatchObject({ code: "cancelled" });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("does not call the transport for a pre-cancelled request", async () => {
    const fetcher = queued();
    const controller = new AbortController(); controller.abort();
    await expect(createCloudAdapters({ fetcher }).deepl.translate("Hallo", deepl, controller.signal)).rejects.toMatchObject({ code: "cancelled" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("bounds response streams without trusting Content-Length", async () => {
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({ pull(controller) { controller.enqueue(new Uint8Array(270_000)); }, cancel() { cancelled = true; } });
    const fetcher = queued(new Response(stream));
    await expect(createCloudAdapters({ fetcher }).microsoft.translate("Hallo", microsoft, signal())).rejects.toMatchObject({ code: "invalid_output" });
    expect(cancelled).toBe(true);
  });

  it("times out and cancels a stalled response body", async () => {
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({ start() {}, cancel() { cancelled = true; } });
    const fetcher = queued(new Response(stream));
    await expect(createCloudAdapters({ fetcher, timeoutMs: 5 }).deepl.translate("Hallo", deepl, signal())).rejects.toMatchObject({ code: "timeout" });
    expect(cancelled).toBe(true);
  });

  it.each([new Response("not json"), new Response(new Uint8Array([0xff])), Response.json({ translations: [{ text: "x".repeat(20_001) }] })])("rejects invalid or oversized provider output", async response => {
    const fetcher = queued(response);
    await expect(createCloudAdapters({ fetcher }).deepl.translate("Hallo", deepl, signal())).rejects.toMatchObject({ code: "invalid_output" });
  });

  it("sanitizes a transport exception", async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new Error("private credential and response details"));
    await expect(createCloudAdapters({ fetcher }).deepl.translate("Hallo", deepl, signal())).rejects.toMatchObject({ code: "network", message: "network" });
  });
});
