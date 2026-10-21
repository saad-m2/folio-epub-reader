import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BUNDLED_FONT_SHA256, DEFAULT_FONT, FONT_CATALOG, FontManager, type DownloadableFont } from "../src/main/fonts";

const roots: string[] = [];
const bytes = Buffer.from("a test font payload");
const entry: DownloadableFont = {
  id: "test-font", family: "Test Font", label: "Test Font", version: "1.0",
  origin: "https://fonts.example.org/test-font-1.0.ttf",
  sha256: createHash("sha256").update(bytes).digest("hex"),
  license: { name: "SIL OFL 1.1", url: "https://fonts.example.org/OFL.txt", copyright: "Test copyright" },
};

async function root(): Promise<string> {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "epub-fonts-"));
  roots.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map(directory => fs.rm(directory, { recursive: true, force: true })));
});

describe("FontManager", () => {
  it("provides the bundled font offline and only the pinned optional catalog", async () => {
    const manager = new FontManager(await root());
    const listed = await manager.list();
    expect(listed[0]).toEqual({ ...DEFAULT_FONT, installed: true });
    expect(listed.slice(1).map(font => font.id)).toEqual(FONT_CATALOG.map(font => font.id));
    expect(listed.slice(1).every(font => !font.installed)).toBe(true);
    await expect(manager.install("unapproved")).rejects.toThrow("approved catalog");
  });

  it("reads the licensed packaged default and verifies its pinned hash", async () => {
    const manager = new FontManager(await root());
    const font = await manager.readBundled(path.resolve("src/renderer/public"));
    expect(createHash("sha256").update(font).digest("hex")).toBe(BUNDLED_FONT_SHA256);
  });

  it("installs verified bytes and retains them across manager instances", async () => {
    const directory = await root();
    const download = vi.fn(async () => bytes);
    const manager = new FontManager(directory, [entry], download);
    expect((await manager.list())[1]?.installed).toBe(false);
    await manager.install(entry.id);
    expect(await manager.readInstalled(entry.id)).toEqual(bytes);
    expect((await new FontManager(directory, [entry]).list())[1]?.installed).toBe(true);
    await manager.install(entry.id);
    expect(download).toHaveBeenCalledTimes(1);
  });

  it("rejects changed download bytes and treats corrupt cache as uninstalled", async () => {
    const directory = await root();
    const manager = new FontManager(directory, [entry], async () => Buffer.from("tampered"));
    await expect(manager.install(entry.id)).rejects.toThrow("verification failed");
    expect((await fs.readdir(directory).catch(() => []))).toEqual([]);
    await fs.writeFile(path.join(directory, `${entry.id}-${entry.sha256}.ttf`), "tampered");
    expect((await manager.list())[1]?.installed).toBe(false);
    expect(await manager.readInstalled(entry.id)).toBeUndefined();
  });

  it("rejects non-HTTPS and duplicate catalog entries", async () => {
    const directory = await root();
    expect(() => new FontManager(directory, [{ ...entry, origin: "http://fonts.example.org/font.ttf" }])).toThrow("Invalid bundled");
    expect(() => new FontManager(directory, [entry, entry])).toThrow("Duplicate");
  });
});
