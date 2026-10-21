import { describe, expect, it, vi } from "vitest";
import { LocalTranslationGateway, TRANSLATION_MODEL, TranslationFailure } from "../src/main/translation";

type RequestRecord = { path: string; body?: Record<string, unknown> };

function ollama(initialLoaded = false) {
  let installed = true;
  let loaded = initialLoaded;
  let loadDuration = 0;
  const requests: RequestRecord[] = [];
  const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const path = new URL(String(input)).pathname;
    const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : undefined;
    requests.push({ path, body });
    if (path === "/api/tags") return Response.json({ models: installed ? [{ name: TRANSLATION_MODEL }] : [] });
    if (path === "/api/ps") return Response.json({ models: loaded ? [{ name: TRANSLATION_MODEL }] : [] });
    if (path === "/api/generate") {
      if (body?.keep_alive === 0) loaded = false;
      else if (body?.prompt === "") loaded = true;
      return Response.json({ response: body?.prompt ? "English translation" : "", load_duration: loadDuration, done: true });
    }
    return new Response("", { status: 404 });
  }) as typeof fetch;
  return { fetcher, requests, setInstalled(value: boolean) { installed = value; }, setLoaded(value: boolean) { loaded = value; }, setLoadDuration(value: number) { loadDuration = value; } };
}

describe("local translation gateway", () => {
  it("checks setup without loading or sending book text", async () => {
    const mock = ollama();
    const gateway = new LocalTranslationGateway({ fetcher: mock.fetcher });
    expect(await gateway.getStatus()).toEqual({ state: "unloaded" });
    mock.setInstalled(false);
    expect(await gateway.getStatus()).toEqual({ state: "missing" });
    expect(mock.requests.map(request => request.path)).toEqual(["/api/tags", "/api/ps", "/api/tags"]);
  });

  it("loads explicitly, translates only a loaded model, and unloads", async () => {
    const mock = ollama();
    const gateway = new LocalTranslationGateway({ fetcher: mock.fetcher });
    await expect(gateway.translate("Hallo")).rejects.toMatchObject({ code: "unloaded" });
    expect(mock.requests.some(request => request.path === "/api/generate")).toBe(false);
    expect(await gateway.load()).toEqual({ state: "loaded" });
    expect(await gateway.translate("Hallo")).toEqual({ text: "English translation" });
    expect(await gateway.unload()).toEqual({ state: "unloaded" });
    const generated = mock.requests.filter(request => request.path === "/api/generate");
    expect(generated).toHaveLength(3);
    expect(generated[0].body).toMatchObject({ model: TRANSLATION_MODEL, prompt: "", keep_alive: -1, stream: false });
    expect(generated[1].body).toMatchObject({ model: TRANSLATION_MODEL, prompt: "Hallo", keep_alive: -1, stream: false });
    expect(generated[2].body).toMatchObject({ model: TRANSLATION_MODEL, prompt: "", keep_alive: 0, stream: false });
    expect(generated[1].body?.system).toEqual(expect.stringContaining("German text into natural English"));
  });

  it("invalidates an unexpected model reload and requests bounded unload", async () => {
    const mock = ollama(true);
    mock.setLoadDuration(1_000_000_000);
    const gateway = new LocalTranslationGateway({ fetcher: mock.fetcher });
    await expect(gateway.translate("Hallo")).rejects.toMatchObject({ code: "unexpected_reload" });
    expect(mock.requests.filter(request => request.body?.keep_alive === 0)).toHaveLength(1);
  });

  it("cancels translation when unload is requested", async () => {
    const mock = ollama(true);
    const fetchSpy = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const path = new URL(String(input)).pathname;
      if (path === "/api/generate" && init?.body && JSON.parse(String(init.body)).prompt === "Hallo") {
        return new Promise<Response>((_resolve, reject) => init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true }));
      }
      return mock.fetcher(input, init);
    });
    const gateway = new LocalTranslationGateway({ fetcher: fetchSpy as typeof fetch });
    const translating = gateway.translate("Hallo");
    await vi.waitFor(() => expect(fetchSpy.mock.calls.some(([input, init]) => String(input).endsWith("/api/generate") && !!init?.body && JSON.parse(String(init.body)).prompt === "Hallo")).toBe(true));
    const unloading = gateway.unload();
    await expect(translating).rejects.toMatchObject({ code: "cancelled" });
    expect(await unloading).toEqual({ state: "unloaded" });
  });

  it("returns bounded categories without leaking service errors", async () => {
    const fetcher = vi.fn(async () => { throw new TypeError("private local service details"); }) as typeof fetch;
    const gateway = new LocalTranslationGateway({ fetcher });
    expect(await gateway.getStatus()).toEqual({ state: "unavailable" });
    await expect(gateway.load()).rejects.toEqual(new TranslationFailure("unavailable"));
  });

  it("times out a stalled local service", async () => {
    const fetcher = vi.fn((_input: string | URL | Request, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
    })) as typeof fetch;
    const gateway = new LocalTranslationGateway({ fetcher, statusTimeoutMs: 5 });
    expect(await gateway.getStatus()).toEqual({ state: "error", reason: "timeout" });
  });

  it("invalidates a translation queued before unload", async () => {
    const mock = ollama(true);
    const gateway = new LocalTranslationGateway({ fetcher: mock.fetcher });
    const first = gateway.translate("Hallo");
    const unloading = gateway.unload();
    await expect(first).rejects.toMatchObject({ code: "cancelled" });
    expect(await unloading).toEqual({ state: "unloaded" });
    expect(mock.requests.some(request => request.body?.prompt === "Hallo")).toBe(false);
  });
});
