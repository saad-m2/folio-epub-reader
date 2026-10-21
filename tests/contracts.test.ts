import { describe, expect, it } from "vitest";
import { ReaderLocationSchema, RendererIntents, limits } from "../src/shared/contracts";

describe("Epic 01 contracts", () => {
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
});
