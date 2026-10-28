import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ColorWheel } from "../src/renderer/color-wheel";
import { AppearanceControls } from "../src/renderer/ui";
import type { Appearance } from "../src/shared/contracts";

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

  it("reuses one wheel for independent background/font edits and resets to automatic text", async () => {
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    let saved: Appearance = { theme: "sepia", fontSize: 18, margin: 48, lineHeight: 1.55, paragraphSpacing: 0.75, fontFamily: "Georgia" };
    const update = vi.fn((next: Appearance) => { saved = next; render(); });
    function render(): void { root.render(React.createElement(AppearanceControls, { appearance: saved, update, fonts: ["Georgia"] })); }
    function button(text: string): HTMLButtonElement { return [...container.querySelectorAll("button")].find(item => item.textContent === text)!; }
    async function setHex(value: string): Promise<void> {
      const input = container.querySelector<HTMLInputElement>("input[type=text]")!;
      await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });
    }
    await act(async () => render());
    await setHex("#abcdef");
    await act(async () => button("Font").click());
    expect(update).not.toHaveBeenCalled();
    expect(container.querySelectorAll(".color-wheel")).toHaveLength(1);
    expect(container.querySelector(".color-wheel")!.getAttribute("aria-label")).toBe("Font color wheel");
    expect(container.querySelector<HTMLInputElement>("input[type=text]")!.value).toBe("#3b4035");
    await setHex("#123456");
    expect(container.querySelector<HTMLElement>(".custom-color-preview")!.style.background).toBe("rgb(238, 231, 216)");
    expect(container.querySelector<HTMLElement>(".custom-color-preview")!.style.color).toBe("rgb(18, 52, 86)");
    await act(async () => button("Apply font color").click());
    expect(saved).toMatchObject({ theme: "custom", backgroundColor: "#eee7d8", fontColor: "#123456" });
    await act(async () => button("Background").click());
    await setHex("#fedcba");
    await act(async () => button("Apply background color").click());
    expect(saved).toMatchObject({ backgroundColor: "#fedcba", fontColor: "#123456" });
    await act(async () => button("Font").click());
    await act(async () => button("Use automatic font color").click());
    expect(saved.fontColor).toBeUndefined();
    expect(saved.backgroundColor).toBe("#fedcba");
  });
});
