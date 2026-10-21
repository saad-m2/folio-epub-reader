import { describe, expect, it } from "vitest";
import { mkdtemp, open, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Session } from "electron";
import { TrustedPublicationSessions } from "../src/main/publications";
import { limits } from "../src/shared/contracts";

async function file(name: string, bytes: Buffer): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), "epub-reader-"));
  const source = path.join(directory, name);
  await writeFile(source, bytes);
  return source;
}

describe("trusted publication handoff", () => {
  it("supersedes an in-flight open when another book opens", async () => {
    const first = await file("first.epub", Buffer.from("first"));
    const second = await file("second.epub", Buffer.from("second"));
    const publications = new TrustedPublicationSessions();
    const owner = {} as Session;
    publications.authorizeSource(first); publications.authorizeSource(second);
    const opening = publications.open(first, owner);
    const replacement = publications.open(second, owner);
    await expect(opening).rejects.toMatchObject({ code: "CANCELLED" });
    const active = await replacement;
    expect(publications.getActiveSessionForSource(first)).toBeUndefined();
    expect(publications.verifySessionOwned(active.sessionId, owner)).toBe(true);
    await publications.closeAll();
  });

  it("renderer cleanup prevents a pending read from reviving its session", async () => {
    const source = await file("pending.epub", Buffer.from("pending"));
    const publications = new TrustedPublicationSessions();
    publications.authorizeSource(source);
    const opening = publications.open(source, {} as Session);
    await publications.closeAll();
    await expect(opening).rejects.toMatchObject({ code: "CANCELLED" });
    expect(publications.getActiveSessionForSource(source)).toBeUndefined();
  });
  it("returns a transient archive buffer only for an authorized source", async () => {
    const source = await file("fixture.epub", Buffer.from("trusted EPUB"));
    const owner = {} as Session;
    const publications = new TrustedPublicationSessions();
    publications.authorizeSource(source);
    const opened = await publications.open(source, owner);
    expect(new TextDecoder().decode(opened.archiveBytes)).toBe("trusted EPUB");
    await publications.closeOwned(opened.sessionId, owner);
    await expect(publications.closeOwned(opened.sessionId, owner)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rejects unauthorized and oversized sources before handoff", async () => {
    const owner = {} as Session;
    const publications = new TrustedPublicationSessions();
    const source = await file("unapproved.epub", Buffer.from("x"));
    await expect(publications.open(source, owner)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    const oversized = await file("oversized.epub", Buffer.alloc(0));
    const handle = await open(oversized, "r+");
    await handle.truncate(limits.maxTrustedArchiveBytes + 1);
    await handle.close();
    publications.authorizeSource(oversized);
    await expect(publications.open(oversized, owner)).rejects.toMatchObject({ code: "QUOTA_EXCEEDED" });
    const wrongExtension = await file("not-a-book.txt", Buffer.from("x"));
    publications.authorizeSource(wrongExtension);
    await expect(publications.open(wrongExtension, owner)).rejects.toMatchObject({ code: "INVALID_EPUB" });
  });

  it("releases every active handoff when renderer recovery closes sessions", async () => {
    const owner = {} as Session;
    const publications = new TrustedPublicationSessions();
    const source = await file("recovery.epub", Buffer.from("trusted EPUB"));
    publications.authorizeSource(source);
    const opened = await publications.open(source, owner);
    await publications.closeAll();
    await expect(publications.closeOwned(opened.sessionId, owner)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("tracks active session per source and verifies ownership", async () => {
    const owner = {} as Session;
    const otherOwner = {} as Session;
    const publications = new TrustedPublicationSessions();
    const source = await file("ownership.epub", Buffer.from("trusted EPUB"));
    publications.authorizeSource(source);
    const opened = await publications.open(source, owner);
    expect(publications.getActiveSessionForSource(source)).toBe(opened.sessionId);
    expect(publications.verifySessionOwnsSource(opened.sessionId, source, owner)).toBe(true);
    expect(publications.verifySessionOwnsSource(opened.sessionId, source, otherOwner)).toBe(false);
    expect(publications.verifySessionOwnsSource("non-existent", source, owner)).toBe(false);
    expect(publications.verifySessionOwned(opened.sessionId, owner)).toBe(true);
    expect(publications.verifySessionOwned(opened.sessionId, otherOwner)).toBe(false);
    await publications.closeOwned(opened.sessionId, owner);
    expect(publications.getActiveSessionForSource(source)).toBeUndefined();
    expect(publications.verifySessionOwned(opened.sessionId, owner)).toBe(false);
  });

  it("rejects closeOwned from different owner", async () => {
    const owner = {} as Session;
    const otherOwner = {} as Session;
    const publications = new TrustedPublicationSessions();
    const source = await file("owner-check.epub", Buffer.from("trusted EPUB"));
    publications.authorizeSource(source);
    const opened = await publications.open(source, owner);
    await expect(publications.closeOwned(opened.sessionId, otherOwner)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await publications.closeOwned(opened.sessionId, owner);
  });
});
