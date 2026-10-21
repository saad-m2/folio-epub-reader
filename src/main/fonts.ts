import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

export const DEFAULT_FONT = {
  id: "liberation-sans", family: "Liberation Sans Reader", label: "Liberation Sans", bundled: true,
  license: {
    name: "SIL Open Font License 1.1",
    url: "https://github.com/liberationfonts/liberation-fonts/blob/main/LICENSE",
    copyright: "Copyright 2010 Google Corporation; Copyright 2012 Red Hat, Inc.",
  },
} as const;
export const BUNDLED_FONT_FILE = "fonts/LiberationSans-Regular.ttf";
export const BUNDLED_FONT_SHA256 = "f8ace1f892b2bd9dc1792ba7f097fa7588f84fed48321480e04de5390828221f";

export type DownloadableFont = {
  id: string;
  family: string;
  label: string;
  version: string;
  origin: string;
  sha256: string;
  license: { name: string; url: string; copyright: string };
};

// Exact assets are pinned so the catalog cannot change without an app update.
export const FONT_CATALOG: readonly DownloadableFont[] = [
  {
    id: "atkinson-hyperlegible", family: "Atkinson Hyperlegible Reader", label: "Atkinson Hyperlegible",
    version: "google/fonts@1b22086d13bdbbf5ec63d01a39a49246e4ac355f",
    origin: "https://raw.githubusercontent.com/google/fonts/1b22086d13bdbbf5ec63d01a39a49246e4ac355f/ofl/atkinsonhyperlegible/AtkinsonHyperlegible-Regular.ttf",
    sha256: "7fb917c89019896d0b52ee84b7cbb3304c18cb90b19a62f5e32712bd23e97669",
    license: { name: "SIL Open Font License 1.1", url: "https://github.com/google/fonts/blob/1b22086d13bdbbf5ec63d01a39a49246e4ac355f/ofl/atkinsonhyperlegible/OFL.txt", copyright: "Copyright 2020 Braille Institute of America, Inc." },
  },
  {
    id: "source-serif-4", family: "Source Serif 4 Reader", label: "Source Serif 4",
    version: "google/fonts@7b203a635ebe80801c80f29633d4fc467cd1214e",
    origin: "https://raw.githubusercontent.com/google/fonts/7b203a635ebe80801c80f29633d4fc467cd1214e/ofl/sourceserif4/SourceSerif4%5Bopsz,wght%5D.ttf",
    sha256: "97b2d4da6e3cb494b5a1e66ae176914d852ccabef49e0c02c0df25f3e39aca0b",
    license: { name: "SIL Open Font License 1.1", url: "https://github.com/adobe-fonts/source-serif/blob/release/LICENSE.md", copyright: "Copyright 2014–2021 Adobe Systems Incorporated. Reserved Font Name: Source." },
  },
];

export type FontStatus = { id: string; family: string; label: string; installed: boolean; bundled: boolean; license?: DownloadableFont["license"] };

const MAX_FONT_BYTES = 10 * 1024 * 1024;
const FONT_TIMEOUT_MS = 20_000;

function validEntry(entry: DownloadableFont): boolean {
  const origin = new URL(entry.origin);
  return /^[a-z0-9-]+$/.test(entry.id)
    && /^[a-f0-9]{64}$/.test(entry.sha256)
    && origin.protocol === "https:"
    && !origin.username && !origin.password && !origin.hash
    && Boolean(entry.version && entry.family && entry.label && entry.license.name && entry.license.url && entry.license.copyright);
}

async function fetchFont(entry: DownloadableFont): Promise<Buffer> {
  const response = await fetch(entry.origin, { redirect: "error", signal: AbortSignal.timeout(FONT_TIMEOUT_MS) });
  if (!response.ok) throw new Error("Font download failed");
  const declaredSize = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredSize) && declaredSize > MAX_FONT_BYTES) throw new Error("Font download is too large");
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Font download was empty");
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_FONT_BYTES) throw new Error("Font download is too large");
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks);
}

export class FontManager {
  constructor(
    private readonly root: string,
    private readonly catalog: readonly DownloadableFont[] = FONT_CATALOG,
    private readonly download: (entry: DownloadableFont) => Promise<Buffer> = fetchFont,
  ) {
    for (const entry of catalog) if (!validEntry(entry)) throw new Error(`Invalid bundled font catalog entry: ${entry.id}`);
    if (new Set(catalog.map(entry => entry.id)).size !== catalog.length) throw new Error("Duplicate bundled font catalog ID");
  }

  private file(entry: DownloadableFont): string { return path.join(this.root, `${entry.id}-${entry.sha256}.ttf`); }

  async readBundled(rendererRoot: string): Promise<Buffer> {
    const bytes = await fs.readFile(path.join(rendererRoot, BUNDLED_FONT_FILE));
    if (createHash("sha256").update(bytes).digest("hex") !== BUNDLED_FONT_SHA256) throw new Error("Bundled font is missing or corrupt");
    return bytes;
  }

  async installed(entry: DownloadableFont): Promise<boolean> {
    try {
      const bytes = await fs.readFile(this.file(entry));
      return bytes.length > 0 && bytes.length <= MAX_FONT_BYTES && createHash("sha256").update(bytes).digest("hex") === entry.sha256;
    } catch { return false; }
  }

  async list(): Promise<FontStatus[]> {
    const optional: FontStatus[] = await Promise.all(this.catalog.map(async entry => ({
      id: entry.id, family: entry.family, label: entry.label, bundled: false as const,
      installed: await this.installed(entry), license: entry.license,
    })));
    return [{ ...DEFAULT_FONT, installed: true }, ...optional];
  }

  async install(id: string): Promise<FontStatus> {
    const entry = this.catalog.find(item => item.id === id);
    if (!entry) throw new Error("Font is not in the approved catalog");
    if (!await this.installed(entry)) {
      const bytes = await this.download(entry);
      if (!bytes.length || bytes.length > MAX_FONT_BYTES || createHash("sha256").update(bytes).digest("hex") !== entry.sha256) throw new Error("Font verification failed");
      await fs.mkdir(this.root, { recursive: true });
      const destination = this.file(entry);
      const temp = path.join(this.root, `${entry.id}-${randomUUID()}.tmp`);
      try {
        await fs.writeFile(temp, bytes, { flag: "wx" });
        await fs.rename(temp, destination);
      } finally { await fs.rm(temp, { force: true }); }
    }
    return { id: entry.id, family: entry.family, label: entry.label, bundled: false, installed: true, license: entry.license };
  }

  async readInstalled(id: string): Promise<Buffer | undefined> {
    const entry = this.catalog.find(item => item.id === id);
    if (!entry || !await this.installed(entry)) return undefined;
    return fs.readFile(this.file(entry));
  }
}
