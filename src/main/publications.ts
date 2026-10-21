import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { Session } from "electron";
import { limits } from "../shared/contracts";
import { safeError } from "./security";

type LiveSession = { id: string; owner: Session; sourcePath: string };

export class TrustedPublicationSessions {
  private sessions = new Map<string, LiveSession>();
  private authorizedPaths = new Set<string>();
  private activeBySource = new Map<string, string>();
  private generation = 0;

  authorizeSource(sourcePath: string): void { this.authorizedPaths.add(path.resolve(sourcePath)); }

  async open(sourcePath: string, owner: Session): Promise<{ sessionId: string; archiveBytes: ArrayBuffer; archiveHash: string }> {
    const authorizedPath = path.resolve(sourcePath);
    if (!this.authorizedPaths.delete(authorizedPath)) throw safeError("UNAUTHORIZED");
    const generation = ++this.generation;
    this.sessions.clear();
    this.activeBySource.clear();
    if (path.extname(authorizedPath).toLowerCase() !== ".epub") throw safeError("INVALID_EPUB");
    let stat: Awaited<ReturnType<typeof fs.stat>>;
    try { stat = await fs.stat(authorizedPath); } catch { throw safeError("NOT_FOUND"); }
    if (!stat.isFile()) throw safeError("INVALID_EPUB");
    if (stat.size > limits.maxTrustedArchiveBytes) throw safeError("QUOTA_EXCEEDED");
    let bytes: Buffer;
    try { bytes = await fs.readFile(authorizedPath); } catch { throw safeError("NOT_FOUND"); }
    if (bytes.byteLength > limits.maxTrustedArchiveBytes) throw safeError("QUOTA_EXCEEDED");
    if (generation !== this.generation) throw safeError("CANCELLED");
    const sessionId = randomUUID();
    this.sessions.set(sessionId, { id: sessionId, owner, sourcePath: authorizedPath });
    this.activeBySource.set(authorizedPath, sessionId);
    return { sessionId, archiveBytes: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer, archiveHash: createHash("sha256").update(bytes).digest("hex") };
  }

  async closeOwned(sessionId: string, owner: Session): Promise<void> {
    const live = this.sessions.get(sessionId);
    if (!live || live.owner !== owner) throw safeError("UNAUTHORIZED");
    this.activeBySource.delete(live.sourcePath);
    this.sessions.delete(sessionId);
  }

  async closeAll(): Promise<void> {
    ++this.generation;
    this.activeBySource.clear();
    this.sessions.clear();
  }

  verifySessionOwnsSource(sessionId: string, sourcePath: string, owner: Session): boolean {
    const live = this.sessions.get(sessionId);
    return !!live && live.owner === owner && live.sourcePath === path.resolve(sourcePath);
  }

  verifySessionOwned(sessionId: string, owner: Session): boolean {
    return this.sessions.get(sessionId)?.owner === owner;
  }

  getActiveSessionForSource(sourcePath: string): string | undefined {
    return this.activeBySource.get(path.resolve(sourcePath));
  }
}
