import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { limits, type Appearance, type LibraryBook, type ReaderLocation, type ReaderMode } from "../shared/contracts";

type BookRow = {
  id: string;
  source_path: string;
  source_size: number;
  source_mtime_ms: number;
  content_hash: string;
  package_id: string | null;
  title: string;
  author: string;
  added_at: number;
  opened_at: number | null;
};

type Cover = { mime: "image/jpeg" | "image/png" | "image/webp"; data: string };
export class SourceValidationError extends Error {
  constructor(readonly code: "MISSING" | "CHANGED" | "UNREADABLE") { super(code); }
}

export function sourceValidationError(error: unknown): SourceValidationError {
  const code = typeof error === "object" && error && "code" in error ? error.code : undefined;
  return new SourceValidationError(code === "ENOENT" || code === "ENOTDIR" ? "MISSING" : "UNREADABLE");
}

export class LibraryRepository {
  private readonly db: DatabaseSync;

  constructor(databasePath: string) {
    this.db = new DatabaseSync(databasePath);
    this.db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
    this.migrate();
  }

  private migrate(): void {
    this.db.exec("CREATE TABLE IF NOT EXISTS migrations (version INTEGER PRIMARY KEY)");
    const migrations: Array<{ version: number; sql: string }> = [{ version: 1, sql: `
      CREATE TABLE IF NOT EXISTS books (
        id TEXT PRIMARY KEY,
        source_path TEXT NOT NULL,
        source_size INTEGER NOT NULL,
        source_mtime_ms INTEGER NOT NULL,
        content_hash TEXT NOT NULL UNIQUE,
        package_id TEXT,
        title TEXT NOT NULL,
        author TEXT NOT NULL,
        added_at INTEGER NOT NULL,
        opened_at INTEGER
      );
      CREATE TABLE IF NOT EXISTS reading_positions (
        book_id TEXT PRIMARY KEY REFERENCES books(id) ON DELETE CASCADE,
        href TEXT NOT NULL,
        cfi TEXT,
        quote TEXT,
        quote_prefix TEXT,
        quote_suffix TEXT,
        nav_id TEXT,
        nav_progress REAL,
        resource_progress REAL
      );
      CREATE TABLE IF NOT EXISTS preferences (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS font_assets (id TEXT PRIMARY KEY, state TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS encrypted_secrets (key TEXT PRIMARY KEY, value BLOB NOT NULL);
      INSERT OR IGNORE INTO preferences(key, value) VALUES ('readerMode', 'continuous');
    ` }, { version: 2, sql: `
      CREATE TABLE IF NOT EXISTS cover_cache (
        book_id TEXT PRIMARY KEY REFERENCES books(id) ON DELETE CASCADE,
        mime TEXT NOT NULL,
        data BLOB NOT NULL
      );
    ` }];
    const applied = new Set((this.db.prepare("SELECT version FROM migrations").all() as Array<{ version: number }>).map(row => row.version));
    for (const migration of migrations) {
      if (applied.has(migration.version)) continue;
      this.db.exec("BEGIN");
      try {
        this.db.exec(migration.sql);
        this.db.prepare("INSERT INTO migrations(version) VALUES (?)").run(migration.version);
        this.db.exec("COMMIT");
      } catch (error) { this.db.exec("ROLLBACK"); throw error; }
    }
  }

  close(): void { this.db.close(); }

  list(): LibraryBook[] {
    const rows = this.db.prepare("SELECT b.*, COALESCE(p.resource_progress, 0) AS progress FROM books b LEFT JOIN reading_positions p ON p.book_id = b.id ORDER BY b.opened_at IS NULL, b.opened_at DESC, b.added_at DESC").all() as Array<BookRow & { progress: number }>;
    return rows.map(row => {
      const cover = this.db.prepare("SELECT mime, data FROM cover_cache WHERE book_id = ?").get(row.id) as { mime: string; data: Uint8Array } | undefined;
      return { id: row.id, title: row.title, author: row.author, progress: row.progress, missing: false, ...(cover ? { cover: `data:${cover.mime};base64,${Buffer.from(cover.data).toString("base64")}` } : {}) };
    });
  }

  get(id: string): BookRow | undefined { return this.db.prepare("SELECT * FROM books WHERE id = ?").get(id) as BookRow | undefined; }
  findByHash(contentHash: string): BookRow | undefined { return this.db.prepare("SELECT * FROM books WHERE content_hash = ?").get(contentHash) as BookRow | undefined; }
  findByPackageId(packageId: string): BookRow | undefined { return this.db.prepare("SELECT * FROM books WHERE package_id = ?").get(packageId) as BookRow | undefined; }

  add(input: { sourcePath: string; size: number; mtimeMs: number; hash: string; title: string; author: string; packageId?: string; cover?: Cover }): string {
    const id = randomUUID();
    this.db.exec("BEGIN");
    try {
      this.db.prepare("INSERT INTO books(id, source_path, source_size, source_mtime_ms, content_hash, package_id, title, author, added_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(id, input.sourcePath, input.size, input.mtimeMs, input.hash, input.packageId ?? null, input.title, input.author, Date.now());
      this.saveCover(id, input.cover);
      this.db.exec("COMMIT");
    } catch (error) { this.db.exec("ROLLBACK"); throw error; }
    return id;
  }

  replace(id: string, input: { sourcePath: string; size: number; mtimeMs: number; hash: string; title: string; author: string; packageId?: string; preserveProgress: boolean; cover?: Cover; resolvedLocation?: ReaderLocation }): void {
    this.db.exec("BEGIN");
    try {
      this.db.prepare("UPDATE books SET source_path = ?, source_size = ?, source_mtime_ms = ?, content_hash = ?, package_id = ?, title = ?, author = ? WHERE id = ?").run(input.sourcePath, input.size, input.mtimeMs, input.hash, input.packageId ?? null, input.title, input.author, id);
      if (!input.preserveProgress) this.db.prepare("DELETE FROM reading_positions WHERE book_id = ?").run(id);
      if (input.resolvedLocation) this.saveLocation(id, input.resolvedLocation);
      if (input.cover) this.saveCover(id, input.cover);
      else this.db.prepare("DELETE FROM cover_cache WHERE book_id = ?").run(id);
      this.db.exec("COMMIT");
    } catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }

  remove(id: string): void {
    this.db.exec("BEGIN");
    try { this.db.prepare("DELETE FROM books WHERE id = ?").run(id); this.db.exec("COMMIT"); } catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }
  markOpened(id: string): void { this.db.prepare("UPDATE books SET opened_at = ? WHERE id = ?").run(Date.now(), id); }
  updateSourceEvidence(id: string, size: number, mtimeMs: number): void { this.db.prepare("UPDATE books SET source_size = ?, source_mtime_ms = ? WHERE id = ?").run(size, mtimeMs, id); }

  getLocation(bookId: string): ReaderLocation | undefined {
    const row = this.db.prepare("SELECT href, cfi, quote, quote_prefix, quote_suffix, nav_id, nav_progress, resource_progress FROM reading_positions WHERE book_id = ?").get(bookId) as Record<string, unknown> | undefined;
    if (!row) return undefined;
    return { href: row.href as string, ...(row.cfi ? { cfi: row.cfi as string } : {}), ...(row.quote ? { quote: row.quote as string } : {}), ...(row.quote_prefix ? { quotePrefix: row.quote_prefix as string } : {}), ...(row.quote_suffix ? { quoteSuffix: row.quote_suffix as string } : {}), ...(row.nav_id ? { navId: row.nav_id as string } : {}), ...(typeof row.nav_progress === "number" ? { navProgress: row.nav_progress } : {}), ...(typeof row.resource_progress === "number" ? { resourceProgress: row.resource_progress } : {}) };
  }

  private saveCover(bookId: string, cover: Cover | undefined): void {
    if (!cover) return;
    this.db.prepare("INSERT INTO cover_cache(book_id, mime, data) VALUES (?, ?, ?) ON CONFLICT(book_id) DO UPDATE SET mime = excluded.mime, data = excluded.data").run(bookId, cover.mime, Buffer.from(cover.data, "base64"));
  }

  saveLocation(bookId: string, location: ReaderLocation): void {
    this.db.prepare("INSERT INTO reading_positions(book_id, href, cfi, quote, quote_prefix, quote_suffix, nav_id, nav_progress, resource_progress) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(book_id) DO UPDATE SET href = excluded.href, cfi = excluded.cfi, quote = excluded.quote, quote_prefix = excluded.quote_prefix, quote_suffix = excluded.quote_suffix, nav_id = excluded.nav_id, nav_progress = excluded.nav_progress, resource_progress = excluded.resource_progress").run(bookId, location.href, location.cfi ?? null, location.quote ?? null, location.quotePrefix ?? null, location.quoteSuffix ?? null, location.navId ?? null, location.navProgress ?? null, location.resourceProgress ?? null);
  }

  getPreferences(): { mode: ReaderMode; pageLayout: "single" | "double"; appearance: Appearance } {
    const values = new Map((this.db.prepare("SELECT key, value FROM preferences").all() as Array<{ key: string; value: string }>).map(row => [row.key, row.value]));
    const number = (key: string, fallback: number): number => Number(values.get(key) ?? fallback);
    const storedColor = values.get("readerBackgroundColor");
    const backgroundColor = storedColor && /^#[0-9a-fA-F]{6}$/.test(storedColor) ? storedColor : undefined;
    const storedTheme = values.get("readerTheme");
    const theme = storedTheme === "custom" ? (backgroundColor ? "custom" : "system") : storedTheme === "light" || storedTheme === "dark" || storedTheme === "sepia" ? storedTheme : "system";
    return { mode: values.get("readerMode") === "paginated" ? "paginated" : "continuous", pageLayout: values.get("pageLayout") === "double" ? "double" : "single", appearance: { theme, ...(backgroundColor ? { backgroundColor } : {}), fontSize: number("fontSize", 18), margin: number("readerMargin", 48), lineHeight: number("lineHeight", 1.55), paragraphSpacing: number("paragraphSpacing", 0.75), fontFamily: values.get("fontFamily") ?? "Liberation Sans Reader" } };
  }

  savePreferences(input: Partial<{ mode: ReaderMode; pageLayout: "single" | "double"; appearance: Appearance }>): void {
    const update = (key: string, value: string): void => { this.db.prepare("INSERT INTO preferences(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, value); };
    this.db.exec("BEGIN");
    try {
      if (input.mode) update("readerMode", input.mode);
      if (input.pageLayout) update("pageLayout", input.pageLayout);
      if (input.appearance?.backgroundColor) update("readerBackgroundColor", input.appearance.backgroundColor);
      if (input.appearance) for (const [key, value] of Object.entries({ readerTheme: input.appearance.theme, fontSize: input.appearance.fontSize, readerMargin: input.appearance.margin, lineHeight: input.appearance.lineHeight, paragraphSpacing: input.appearance.paragraphSpacing, fontFamily: input.appearance.fontFamily })) update(key, String(value));
      this.db.exec("COMMIT");
    } catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }
}

export async function revalidateSource(book: BookRow, repository: LibraryRepository): Promise<void> {
  let stat: Awaited<ReturnType<typeof fs.stat>>;
  try { stat = await fs.stat(book.source_path); } catch (error) { throw sourceValidationError(error); }
  if (!stat.isFile()) throw new SourceValidationError("MISSING");
  if (stat.size > limits.maxTrustedArchiveBytes) throw new SourceValidationError("UNREADABLE");
  let bytes: Buffer;
  try { bytes = await fs.readFile(book.source_path); } catch (error) { throw sourceValidationError(error); }
  const hash = createHash("sha256").update(bytes).digest("hex");
  if (hash !== book.content_hash) throw new SourceValidationError("CHANGED");
  if (stat.size !== book.source_size || stat.mtimeMs !== book.source_mtime_ms) repository.updateSourceEvidence(book.id, stat.size, stat.mtimeMs);
}

export async function inspectLocalEpub(sourcePath: string): Promise<{ sourcePath: string; size: number; mtimeMs: number; hash: string; title: string; author: string }> {
  const sourcePathResolved = path.resolve(sourcePath);
  const stat = await fs.stat(sourcePathResolved);
  const bytes = await fs.readFile(sourcePathResolved);
  const hash = createHash("sha256").update(bytes).digest("hex");
  // EPUB metadata extraction is performed by ReaderAdapter in Epic 3. Filename is the explicit interim library fallback.
  const title = path.basename(sourcePathResolved, path.extname(sourcePathResolved));
  return { sourcePath: sourcePathResolved, size: stat.size, mtimeMs: stat.mtimeMs, hash, title: title || "Untitled book", author: "Unknown author" };
}
