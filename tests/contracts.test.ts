import { describe, expect, it } from "vitest";
import { ReaderLocationSchema, RendererIntents, limits } from "../src/shared/contracts";

describe("Epic 01 contracts", () => {
  it("limits cloud configuration to named providers and validated credential fields", () => {
    expect(RendererIntents.saveTranslationProvider.safeParse({ provider: "microsoft", apiKey: "test-key", region: "westeurope" }).success).toBe(true);
    expect(RendererIntents.saveTranslationProvider.safeParse({ provider: "deepl", apiKey: "test-key:fx" }).success).toBe(true);
    expect(RendererIntents.saveTranslationProvider.safeParse({ provider: "deepl", apiKey: "test-key:fx", url: "https://private.invalid" }).success).toBe(false);
    expect(RendererIntents.saveTranslationProvider.safeParse({ provider: "microsoft", apiKey: "test-key", region: "localhost:8080" }).success).toBe(false);
    expect(RendererIntents.saveTranslationProvider.safeParse({ provider: "microsoft", apiKey: "key\r\nheader: injection" }).success).toBe(false);
    expect(RendererIntents.saveTranslationProvider.safeParse({ provider: "deepl", apiKey: "x".repeat(513) }).success).toBe(false);
    expect(RendererIntents.setTranslationProvider.safeParse({ provider: "ollama", preferred: "deepl" }).success).toBe(false);
    expect(RendererIntents.removeTranslationProvider.safeParse({ provider: "ollama" }).success).toBe(false);
    expect(RendererIntents.checkTranslationProviderAvailability.safeParse({ provider: "microsoft", text: "book passage" }).success).toBe(false);
    expect(RendererIntents.getTranslationRequestStatus.safeParse({ sessionId: crypto.randomUUID(), selectionId: crypto.randomUUID() }).success).toBe(true);
    expect(RendererIntents.getTranslationRequestStatus.safeParse({ sessionId: crypto.randomUUID(), selectionId: crypto.randomUUID(), text: "private" }).success).toBe(false);
  });

  it("rejects the retired AWS provider on every configuration and routing intent", () => {
    expect(RendererIntents.saveTranslationProvider.safeParse({ provider: "aws", accessKeyId: "test-key", secretAccessKey: "test-secret", region: "eu-central-1", sessionToken: "test-token" }).success).toBe(false);
    expect(RendererIntents.saveTranslationProvider.safeParse({ provider: "aws", apiKey: "test-key" }).success).toBe(false);
    for (const intent of [RendererIntents.setTranslationProvider, RendererIntents.removeTranslationProvider, RendererIntents.checkTranslationProviderAvailability]) {
      expect(intent.safeParse({ provider: "aws" }).success).toBe(false);
      expect(intent.safeParse({ provider: "microsoft" }).success).toBe(true);
      expect(intent.safeParse({ provider: "deepl" }).success).toBe(true);
    }
    expect(RendererIntents.setTranslationProvider.safeParse({ provider: "ollama" }).success).toBe(true);
  });
  it("accepts only the supported page layouts while preserving partial settings updates", () => {
    expect(RendererIntents.saveSettings.safeParse({ pageLayout: "single" }).success).toBe(true);
    expect(RendererIntents.saveSettings.safeParse({ pageLayout: "double" }).success).toBe(true);
    expect(RendererIntents.saveSettings.safeParse({ pageLayout: "auto" }).success).toBe(false);
    expect(RendererIntents.saveSettings.safeParse({ mode: "continuous" }).success).toBe(true);
  });

  it("keeps session-scoped intents narrow", () => {
    expect(RendererIntents.openSession.safeParse({ bookId: "not-a-uuid", path: "C:\\book.epub" }).success).toBe(false);
    expect(RendererIntents.closeSession.safeParse({ sessionId: crypto.randomUUID(), archiveBytes: new ArrayBuffer(1) }).success).toBe(false);
    expect(RendererIntents.commitImport.safeParse({ sessionId: crypto.randomUUID(), title: "x".repeat(501), author: "Author" }).success).toBe(false);
  });

  it("keeps locations renderer-engine-neutral and bounded", () => {
    expect(ReaderLocationSchema.safeParse({ href: "OEBPS/chapter.xhtml", cfi: "x".repeat(4_001) }).success).toBe(false);
    expect(ReaderLocationSchema.safeParse({ href: "OEBPS/chapter.xhtml", resourceProgress: 0.5 }).success).toBe(true);
  });

  it("accepts only named, bounded renderer intents", () => {
    expect(RendererIntents.registerTranslationSelection.safeParse({ sessionId: crypto.randomUUID(), text: "x".repeat(limits.maxIpcText + 1), rects: [] }).success).toBe(false);
    expect(RendererIntents.translateSelection.safeParse({ sessionId: crypto.randomUUID(), selectionId: crypto.randomUUID(), text: "leak" }).success).toBe(false);
    expect(RendererIntents.copyTranslation.safeParse({ sessionId: crypto.randomUUID(), selectionId: crypto.randomUUID(), text: "leak" }).success).toBe(false);
    expect(RendererIntents.openExternalLink.safeParse({ sessionId: crypto.randomUUID(), url: "file:///secret" }).success).toBe(false);
    expect(RendererIntents.openExternalLink.safeParse({ sessionId: crypto.randomUUID(), url: "https://example.invalid/reader-smoke" }).success).toBe(true);
  });

  it("rejects oversized selection rectangles before validating their contents", () => {
    let inspected = 0;
    const rect = { get x() { inspected++; return 0; }, y: 0, width: 1, height: 1 };
    const result = RendererIntents.registerTranslationSelection.safeParse({
      sessionId: crypto.randomUUID(), text: "Selection", rects: Array(41).fill(rect),
    });
    expect(result.success).toBe(false);
    expect(inspected).toBe(0);
  });
});
