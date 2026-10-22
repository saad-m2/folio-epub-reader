import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ColorWheel } from "../src/renderer/color-wheel";

describe("background color wheel interaction", () => {
  let root: Root;
  let container: HTMLDivElement;
  const apply = vi.fn();
  beforeEach(async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    apply.mockClear();
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    await act(async () => root.render(React.createElement(ColorWheel, { color: "#ff0000", active: false, apply })));
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it("previews keyboard adjustments and commits once when Apply is chosen", async () => {
    const wheel = container.querySelector<HTMLElement>("[role=slider]")!;
    for (let i = 0; i < 12; i++) {
      await act(async () => { wheel.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", shiftKey: true, bubbles: true })); });
    }
    expect(wheel.getAttribute("aria-valuenow")).toBe("120");
    expect(container.querySelector<HTMLInputElement>("input[type=text]")!.value).toBe("#00ff00");
    expect(apply).not.toHaveBeenCalled();
    await act(async () => container.querySelector<HTMLButtonElement>(".btn")!.click());
    expect(apply).toHaveBeenCalledExactlyOnceWith("#00ff00");
  });

  it("does not apply an incomplete hex value and resets the draft when the saved color changes", async () => {
    const input = container.querySelector<HTMLInputElement>("input[type=text]")!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "#12");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(container.querySelector<HTMLButtonElement>(".btn")!.disabled).toBe(true);
    await act(async () => container.querySelector<HTMLButtonElement>(".btn")!.click());
    expect(apply).not.toHaveBeenCalled();
    await act(async () => root.render(React.createElement(ColorWheel, { color: "#123456", active: true, apply })));
    expect(input.value).toBe("#123456");
    expect(container.querySelector<HTMLButtonElement>(".btn")!.disabled).toBe(true);
  });
});
