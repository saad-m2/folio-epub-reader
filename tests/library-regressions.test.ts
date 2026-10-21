import { describe, expect, it } from "vitest";
import { mkdtemp, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { LibraryRepository, inspectLocalEpub, revalidateSource, SourceValidationError, sourceValidationError } from "../src/main/library";

async function temporaryPath(name: string): Promise<string> {
  return path.join(await mkdtemp(path.join(tmpdir(), "epub-library-regression-")), name);
}

describe("library regressions", () => {
  it("records ordered migrations and a cover cache without copying the EPUB", async () => {
    const source = await temporaryPath("cover.epub");
    await writeFile(source, "book bytes");
    const repository = new LibraryRepository(await temporaryPath("library.sqlite"));
    const id = repository.add({ ...await inspectLocalEpub(source), cover: { mime: "image/png", data: Buffer.from("cover").toString("base64") } });
    expect(repository.list()).toEqual([expect.objectContaining({ id, cover: `data:image/png;base64,${Buffer.from("cover").toString("base64")}` })]);
    repository.close();
  });

  it("updates evidence after a harmless timestamp change and rejects changed bytes", async () => {
    const source = await temporaryPath("book.epub");
    await writeFile(source, "original bytes");
    const repository = new LibraryRepository(await temporaryPath("library.sqlite"));
    const id = repository.add(await inspectLocalEpub(source));
    const original = repository.get(id)!;
    await utimes(source, new Date(), new Date(Date.now() + 2_000));
    await revalidateSource(original, repository);
    expect(repository.get(id)?.source_mtime_ms).not.toBe(original.source_mtime_ms);
    await writeFile(source, "replacement bytes");
    await expect(revalidateSource(repository.get(id)!, repository)).rejects.toEqual(expect.objectContaining<Partial<SourceValidationError>>({ code: "CHANGED" }));
    repository.close();
  });

  it("rejects changed bytes even when size and timestamp match the saved evidence", async () => {
    const source = await temporaryPath("same-evidence.epub");
    await writeFile(source, "original bytes");
    const repository = new LibraryRepository(await temporaryPath("library.sqlite"));
    const id = repository.add(await inspectLocalEpub(source));
    const original = repository.get(id)!;
    await writeFile(source, "modified bytes");
    await utimes(source, new Date(), new Date(original.source_mtime_ms));
    await expect(revalidateSource(original, repository)).rejects.toEqual(expect.objectContaining<Partial<SourceValidationError>>({ code: "CHANGED" }));
    repository.close();
  });

  it("reports inaccessible sources as unreadable rather than missing", async () => {
    expect(sourceValidationError(Object.assign(new Error("access denied"), { code: "EACCES" }))).toEqual(expect.objectContaining<Partial<SourceValidationError>>({ code: "UNREADABLE" }));
    expect(sourceValidationError(Object.assign(new Error("missing"), { code: "ENOENT" }))).toEqual(expect.objectContaining<Partial<SourceValidationError>>({ code: "MISSING" }));
  });

  it("commits or rolls back replacement state with the resolved locator", async () => {
    const first = await temporaryPath("first.epub");
    const replacement = await temporaryPath("replacement.epub");
    await writeFile(first, "first");
    await writeFile(replacement, "replacement");
    const repository = new LibraryRepository(await temporaryPath("library.sqlite"));
    const id = repository.add(await inspectLocalEpub(first));
    repository.saveLocation(id, { href: "chapter.xhtml", quote: "marker", resourceProgress: 0.4 });
    repository.replace(id, { ...await inspectLocalEpub(replacement), title: "Replacement", author: "Author", preserveProgress: true, resolvedLocation: { href: "chapter.xhtml", quote: "marker", resourceProgress: 0.4 } });
    expect(repository.getLocation(id)).toEqual({ href: "chapter.xhtml", quote: "marker", resourceProgress: 0.4 });
    repository.close();
  });

  it("resets changed replacement progress when no locator resolves", async () => {
    const first = await temporaryPath("first.epub");
    const replacement = await temporaryPath("replacement.epub");
    await writeFile(first, "first");
    await writeFile(replacement, "changed");
    const repository = new LibraryRepository(await temporaryPath("library.sqlite"));
    const id = repository.add({ ...await inspectLocalEpub(first), packageId: "shared-package-id" });
    repository.saveLocation(id, { href: "chapter.xhtml", quote: "missing marker", resourceProgress: 0.4 });
    repository.replace(id, { ...await inspectLocalEpub(replacement), packageId: "shared-package-id", title: "Replacement", author: "Author", preserveProgress: false });
    expect(repository.getLocation(id)).toBeUndefined();
    expect(repository.findByPackageId("shared-package-id")?.id).toBe(id);
    repository.close();
  });

  it("removes an old cover when a changed replacement has no cover", async () => {
    const first = await temporaryPath("covered.epub");
    const replacement = await temporaryPath("uncovered.epub");
    await writeFile(first, "first");
    await writeFile(replacement, "second");
    const repository = new LibraryRepository(await temporaryPath("library.sqlite"));
    const id = repository.add({ ...await inspectLocalEpub(first), cover: { mime: "image/png", data: Buffer.from("old cover").toString("base64") } });
    expect(repository.list()[0]?.cover).toBeDefined();
    repository.replace(id, { ...await inspectLocalEpub(replacement), preserveProgress: false });
    expect(repository.list()[0]?.cover).toBeUndefined();
    repository.close();
  });
});
