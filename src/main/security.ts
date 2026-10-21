import type { IpcMainInvokeEvent } from "electron";
import { randomUUID } from "node:crypto";
import type { SafeError } from "../shared/contracts";
import { SafeErrorSchema } from "../shared/contracts";

export function safeError(code: SafeError["code"]): SafeError {
  return { code, correlationId: randomUUID() };
}

export function redactError(error: unknown): SafeError {
  const parsed = SafeErrorSchema.safeParse(error);
  return parsed.success ? parsed.data : safeError("INVALID_REQUEST");
}

export function requireAppMainFrame(event: IpcMainInvokeEvent): void {
  const frame = event.senderFrame;
  let trusted = false;
  try {
    const url = new URL(frame?.url ?? "");
    trusted = url.protocol === "app:" && url.hostname === "app" && !url.port && !url.username && !url.password;
  } catch { /* Invalid origins are denied. */ }
  if (!frame || frame !== event.sender.mainFrame || !trusted) throw safeError("UNAUTHORIZED");
}
