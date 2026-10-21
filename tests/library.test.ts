import { describe, expect, it } from "vitest";
import { mkdtemp, readFile, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { LibraryRepository, inspectLocalEpub } from "../src/main/library";

async function temporaryPath(name: string): Promise<string> {
  return path.join(await mkdtemp(path.join(tmpdir(), "epub-library-")), name);
}

describe("persistent local library", () => {
  it("persists source references and normalized progress without copying the EPUB", async () => {
    const source = await temporaryPath("A Book.epub");
    await writeFile(source, Buffer.from("PK\x03\x04book"));
    const database = await temporaryPath("library.sqlite");
    const repository = new LibraryRepository(database);
    const input = await inspectLocalEpub(source);
    const id = repository.add(input);
    repository.saveLocation(id, { href: "chapter.xhtml", resourceProgress: 0.4 });
    expect(repository.list()).toEqual([{ id, title: "A Book", author: "Unknown author", progress: 0.4, missing: false }]);
    repository.close();

    const restarted = new LibraryRepository(database);
    expect(restarted.get(id)?.source_path).toBe(path.resolve(source));
    expect(restarted.list()[0]?.progress).toBe(0.4);
    restarted.remove(id);
    expect(restarted.list()).toEqual([]);
    expect(await readFile(source, "utf8")).toBe("PK\x03\x04book");
    restarted.close();
  });

  it("uses byte hashes as exact duplicate evidence and clears progress on changed replacement", async () => {
    const source = await temporaryPath("first.epub");
    const replacement = await temporaryPath("replacement.epub");
    await writeFile(source, "same bytes");
    await writeFile(replacement, "changed bytes");
    const repository = new LibraryRepository(await temporaryPath("library.sqlite"));
    const original = await inspectLocalEpub(source);
    const id = repository.add({ ...original, packageId: "book-id" });
    repository.saveLocation(id, { href: "chapter.xhtml", resourceProgress: 0.6 });
    expect(repository.findByHash(original.hash)?.id).toBe(id);
    expect(repository.findByPackageId("book-id")?.id).toBe(id);
    const changed = await inspectLocalEpub(replacement);
    repository.replace(id, { ...changed, preserveProgress: false });
    expect(repository.list()[0]?.progress).toBe(0);
    repository.close();
    await unlink(source);
  });
});
