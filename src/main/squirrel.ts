import path from "node:path";
import { spawn } from "node:child_process";

// Squirrel calls the installed executable to maintain its Start/Desktop shortcuts.
export async function handleSquirrelEvent(): Promise<boolean> {
  if (process.platform !== "win32") return false;
  const event = process.argv[1];
  if (event === "--squirrel-obsolete") return true;
  if (!["--squirrel-install", "--squirrel-updated", "--squirrel-uninstall"].includes(event)) return false;
  const update = path.resolve(path.dirname(process.execPath), "..", "Update.exe");
  const operation = event === "--squirrel-uninstall" ? "--removeShortcut" : "--createShortcut";
  await new Promise<void>(resolve => {
    const child = spawn(update, [operation, path.basename(process.execPath)], { windowsHide: true });
    const timer = setTimeout(() => { child.kill(); resolve(); }, 10_000);
    const done = () => { clearTimeout(timer); resolve(); };
    child.once("error", done);
    child.once("exit", done);
  });
  return true;
}
