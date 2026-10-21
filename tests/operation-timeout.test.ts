import { describe, expect, it } from "vitest";
import { withTimeout } from "../src/renderer/operation-timeout";

describe("renderer operation timeouts", () => {
  it("rejects stalled archive operations without waiting indefinitely", async () => {
    await expect(withTimeout(new Promise<void>(() => {}), "timed out", 5)).rejects.toThrow("timed out");
  });

  it("returns a completed operation before its deadline", async () => {
    await expect(withTimeout(Promise.resolve("ready"), "timed out", 5)).resolves.toBe("ready");
  });
});
