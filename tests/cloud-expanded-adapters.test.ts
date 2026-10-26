// @vitest-environment node
import { createHash, createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { CLOUD_AVAILABILITY_PHRASE, createCloudAdapters } from "../src/main/cloud-adapters";
import type { ProviderConfiguration } from "../src/shared/translation";

const configs = {
  zpk: { provider: "zpk", applicationId: "app-id", apiKey: "zpk-key" },
  lara: { provider: "lara", accessKeyId: "access-id", accessKeySecret: "secret" },
  traduck: { provider: "traduck", apiKey: "tk_live_test" },
} satisfies Record<string, ProviderConfiguration>;
const signal = () => new AbortController().signal;
const auth = () => Response.json({ token: "bounded-token" });
const zpkSuccess = () => Response.json({ success: true, results: [{ translations: { en: "Good day." } }] });
const unclear = () => Response.json({ success: false, errors: [{ id: "UNDOCUMENTED_ERROR", message: "private" }] });
function queued(...responses: Response[]) {
  return vi.fn<typeof fetch>().mockImplementation(async () => {
    const reply = responses.shift();
    if (!reply) throw new Error("Unexpected request");
    return reply;
  });
}

describe("expanded provider protocols", () => {
  it("sends one bounded German-to-English ZPK selection to the fixed endpoint", async () => {
    const fetcher = queued(zpkSuccess());
    await expect(createCloudAdapters({ fetcher }).zpk.translate("Hallo", configs.zpk, signal())).resolves.toEqual({ text: "Good day." });
    expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher.mock.calls[0][0]).toBe("https://zpk.systems/api/translate/text");
    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toEqual({ application_id: "app-id", api_key: "zpk-key", texts: [{ text: "Hallo", source_language: "de", target_languages: ["en"] }] });
    expect(fetcher.mock.calls[0][1]?.redirect).toBe("error");
  });

  it("signs Lara v2 authentication and reads its final NDJSON translation without SDK retries", async () => {
    const fetcher = queued(auth(), new Response('{"status":200,"data":{"translation":"partial"}}\n{"status":200,"data":{"translation":"Good day."}}\n'));
    await expect(createCloudAdapters({ fetcher }).lara.translate("Hallo", configs.lara, signal())).resolves.toEqual({ text: "Good day." });
    expect(fetcher.mock.calls.map(call => call[0])).toEqual(["https://api.laratranslate.com/v2/auth", "https://api.laratranslate.com/v2/translate"]);
    const init = fetcher.mock.calls[0][1]!;
    const headers = init.headers as Record<string, string>;
    const digest = createHash("md5").update('{"id":"access-id"}').digest("base64");
    const expected = createHmac("sha256", "secret").update(`POST\n/v2/auth\n${digest}\napplication/json\n${headers["X-Lara-Date"]}`).digest("base64");
    expect(headers.authorization).toBe(`Lara:${expected}`);
    expect(headers["Content-MD5"]).toBe(digest);
    expect(fetcher.mock.calls[1][1]?.headers).toMatchObject({ authorization: "Bearer bounded-token", "X-No-Trace": "true" });
    expect(JSON.parse(String(fetcher.mock.calls[1][1]?.body))).toEqual({ q: "Hallo", source: "de-DE", target: "en-US", content_type: "text/plain", style: "faithful", reasoning: false, use_cache: false });
  });

  it("uses Traduck bearer auth and quota_exceeded only as exhaustion", async () => {
    const fetcher = queued(Response.json({ translation: "Hello" }), Response.json({ error: { code: "quota_exceeded" } }, { status: 429 }), Response.json({ error: { code: "too_many_requests" } }, { status: 429 }));
    const adapter = createCloudAdapters({ fetcher }).traduck;
    await expect(adapter.translate("Hallo", configs.traduck, signal())).resolves.toEqual({ text: "Hello" });
    await expect(adapter.translate("Hallo", configs.traduck, signal())).rejects.toMatchObject({ code: "exhausted" });
    await expect(adapter.translate("Hallo", configs.traduck, signal())).rejects.toMatchObject({ code: "rate_limited" });
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(fetcher.mock.calls[0]).toMatchObject(["https://traduck.com/api/v1/translate", { headers: { authorization: "Bearer tk_live_test" }, redirect: "error" }]);
    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toEqual({ text: "Hallo", source_lang: "de", target_lang: "en" });
  });
});

describe("owner-approved unclear-error diagnostic", () => {
  it("assumes exhaustion only after the selection and one fixed ZPK probe fail unclearly", async () => {
    const fetcher = queued(unclear(), unclear());
    await expect(createCloudAdapters({ fetcher }).zpk.translate("Private selection", configs.zpk, signal())).rejects.toMatchObject({ code: "exhausted", message: "exhausted" });
    expect(fetcher.mock.calls.map(call => JSON.parse(String(call[1]?.body)).texts[0].text)).toEqual(["Private selection", CLOUD_AVAILABILITY_PHRASE]);
  });

  it("never substitutes a successful probe for the requested translation or resubmits book text", async () => {
    const fetcher = queued(unclear(), zpkSuccess());
    await expect(createCloudAdapters({ fetcher }).zpk.translate("Private selection", configs.zpk, signal())).rejects.toMatchObject({ code: "service_error" });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("also applies the bounded diagnostic to Lara, including embedded stream error statuses", async () => {
    const fetcher = queued(auth(), new Response('{"status":500,"data":{"type":"UnknownError"}}\n'), auth(), Response.json({}, { status: 500 }));
    await expect(createCloudAdapters({ fetcher }).lara.translate("Private selection", configs.lara, signal())).rejects.toMatchObject({ code: "exhausted" });
    expect(fetcher.mock.calls.filter(call => String(call[0]).endsWith("/translate")).map(call => JSON.parse(String(call[1]?.body)).q)).toEqual(["Private selection", CLOUD_AVAILABILITY_PHRASE]);
  });

  it.each([401, 403, 429, 400, 413, 422])("stops on explicit HTTP %s without a probe", async status => {
    const fetcher = queued(Response.json({}, { status }));
    await expect(createCloudAdapters({ fetcher }).zpk.translate("Hallo", configs.zpk, signal())).rejects.toHaveProperty("code", status === 401 || status === 403 ? "authentication" : status === 429 ? "rate_limited" : "invalid_request");
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it.each(["INVALID_API_KEY", "MISSING_REQUIRED_PARAMETER", "RATE_LIMIT_EXCEEDED"])("preserves explicit ZPK %s errors", async id => {
    const fetcher = queued(Response.json({ success: false, errors: [{ id }] }));
    await expect(createCloudAdapters({ fetcher }).zpk.translate("Hallo", configs.zpk, signal())).rejects.toHaveProperty("code", id === "INVALID_API_KEY" ? "authentication" : id === "RATE_LIMIT_EXCEEDED" ? "rate_limited" : "invalid_request");
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("stops if the diagnostic encounters an explicit failure", async () => {
    const fetcher = queued(unclear(), Response.json({}, { status: 401 }));
    await expect(createCloudAdapters({ fetcher }).zpk.translate("Hallo", configs.zpk, signal())).rejects.toMatchObject({ code: "authentication" });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it.each([[503, "service_error"], [504, "timeout"], [404, "invalid_request"]])("does not probe explicit service/protocol status %s", async (status, code) => {
    const fetcher = queued(Response.json({}, { status: Number(status) }));
    await expect(createCloudAdapters({ fetcher }).zpk.translate("Hallo", configs.zpk, signal())).rejects.toMatchObject({ code });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("preserves an explicit ZPK credential error even inside a generic HTTP failure", async () => {
    const fetcher = queued(Response.json({ success: false, errors: [{ id: "INVALID_API_KEY" }] }, { status: 500 }));
    await expect(createCloudAdapters({ fetcher }).zpk.translate("Hallo", configs.zpk, signal())).rejects.toMatchObject({ code: "authentication" });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("checks selection validity before a diagnostic", async () => {
    const fetcher = queued(unclear());
    await expect(createCloudAdapters({ fetcher }).zpk.translate("Hallo", configs.zpk, signal(), () => false)).rejects.toMatchObject({ code: "cancelled" });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("checks cancellation before a diagnostic", async () => {
    const controller = new AbortController();
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => { controller.abort(); return unclear(); });
    await expect(createCloudAdapters({ fetcher }).zpk.translate("Hallo", configs.zpk, controller.signal)).rejects.toMatchObject({ code: "cancelled" });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("does not probe network failures, malformed output, or oversize output", async () => {
    for (const response of [new Response("invalid json"), Response.json({ success: true, results: [] }), new Response("x".repeat(270_000))]) {
      const fetcher = queued(response);
      await expect(createCloudAdapters({ fetcher }).zpk.translate("Hallo", configs.zpk, signal())).rejects.toMatchObject({ code: "invalid_output" });
      expect(fetcher).toHaveBeenCalledOnce();
    }
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new Error("private"));
    await expect(createCloudAdapters({ fetcher }).zpk.translate("Hallo", configs.zpk, signal())).rejects.toMatchObject({ code: "network" });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("does not automatically retry Lara authentication failures", async () => {
    const fetcher = queued(Response.json({}, { status: 401 }));
    await expect(createCloudAdapters({ fetcher }).lara.translate("Hallo", configs.lara, signal())).rejects.toMatchObject({ code: "authentication" });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("does not infer translation exhaustion from an unavailable Lara authentication service", async () => {
    const fetcher = queued(Response.json({}, { status: 500 }));
    await expect(createCloudAdapters({ fetcher }).lara.translate("Hallo", configs.lara, signal())).rejects.toMatchObject({ code: "service_error" });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("does not send book text when the selection expires during Lara authentication", async () => {
    const fetcher = queued(auth());
    await expect(createCloudAdapters({ fetcher }).lara.translate("Hallo", configs.lara, signal(), () => false)).rejects.toMatchObject({ code: "cancelled" });
    expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher.mock.calls[0][0]).toBe("https://api.laratranslate.com/v2/auth");
  });

  it("manual checks send only the fixed sentence and can recover assumed exhaustion", async () => {
    const fetcher = queued(zpkSuccess(), auth(), Response.json({ translation: "Good day." }), Response.json({ translation: "Good day." }));
    const adapters = createCloudAdapters({ fetcher });
    for (const provider of ["zpk", "lara", "traduck"] as const) await expect(adapters[provider].checkAvailability(configs[provider], signal())).resolves.toEqual({ state: "available" });
    const bodies = fetcher.mock.calls.map(call => JSON.parse(String(call[1]?.body)));
    expect(bodies[0].texts[0].text).toBe(CLOUD_AVAILABILITY_PHRASE);
    expect(bodies[2].q).toBe(CLOUD_AVAILABILITY_PHRASE);
    expect(bodies[3].text).toBe(CLOUD_AVAILABILITY_PHRASE);
  });
});
