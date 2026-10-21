import { app } from "electron";
import path from "node:path";

export function configurePaths(): { data: string; session: string } {
  const localAppData = process.env.LOCALAPPDATA || app.getPath("appData");
  const root = process.env.E06_TEST_ROOT && (process.env.E06_RELEASE_TEST === "1" || process.env.E06_UI_TEST === "1")
    ? path.resolve(process.env.E06_TEST_ROOT)
    : path.join(localAppData, "Windows EPUB Reader");
  const data = path.join(root, "Data");
  const session = path.join(root, "Session");
  app.setPath("userData", data);
  app.setPath("sessionData", session);
  return { data, session };
}
