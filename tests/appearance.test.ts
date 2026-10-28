import { describe, expect, it } from "vitest";
import { AppearanceSchema } from "../src/shared/contracts";
import { appearanceColors, customColors, hexToHsv, hsvToHex } from "../src/renderer/appearance";

const appearance = { theme: "light" as const, fontSize: 18, margin: 48, lineHeight: 1.55, paragraphSpacing: 0.75, fontFamily: "Liberation Sans Reader" };

describe("custom reading colors", () => {
  it("accepts legacy preferences and requires a safe six-digit color for custom themes", () => {
    expect(AppearanceSchema.safeParse(appearance).success).toBe(true);
    expect(AppearanceSchema.safeParse({ ...appearance, theme: "custom" }).success).toBe(false);
    expect(AppearanceSchema.safeParse({ ...appearance, theme: "custom", backgroundColor: "#aB12ef" }).success).toBe(true);
    for (const backgroundColor of ["red", "#fff", "#ffffff00", "#ffffff; background: url(https://example.com)"]) {
      expect(AppearanceSchema.safeParse({ ...appearance, theme: "custom", backgroundColor }).success).toBe(false);
      expect(AppearanceSchema.safeParse({ ...appearance, fontColor: backgroundColor }).success).toBe(false);
    }
  });

  it("uses the chosen font and link color only in the custom theme, with a safe automatic fallback", () => {
    const custom = { ...appearance, theme: "custom" as const, backgroundColor: "#123456", fontColor: "#dce8da" };
    expect(AppearanceSchema.safeParse(custom).success).toBe(true);
    expect(appearanceColors(custom)).toEqual({ background: "#123456", color: "#dce8da", link: "#dce8da", visited: "#dce8da" });
    for (const theme of ["light", "dark", "sepia", "system"] as const) {
      expect(appearanceColors({ ...custom, theme })).toEqual(appearanceColors({ ...appearance, theme }));
    }
    expect(customColors("#123456", "red; color: red").color).toBe("#ffffff");
  });

  it("preserves exact RGB colors through wheel conversion including greys and endpoints", () => {
    for (const hex of ["#000000", "#ffffff", "#ff0000", "#00ff00", "#0000ff", "#808080", "#123456", "#fafaf5"]) {
      expect(hsvToHex(hexToHsv(hex))).toBe(hex);
    }
  });

  it("keeps custom text and links at a contrast ratio of at least 4.5:1 across the RGB gamut", () => {
    for (let r = 0; r <= 255; r += 17) for (let g = 0; g <= 255; g += 17) for (let b = 0; b <= 255; b += 17) {
      const hex = `#${[r, g, b].map(c => c.toString(16).padStart(2, "0")).join("")}`;
      const channels = [r, g, b].map(c => c / 255).map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
      const luminance = channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
      const palette = appearanceColors({ ...appearance, theme: "custom", backgroundColor: hex });
      const contrast = palette.color === "#000000" ? (luminance + 0.05) / 0.05 : 1.05 / (luminance + 0.05);
      expect(contrast).toBeGreaterThanOrEqual(4.5);
      expect(palette.background).toBe(hex);
      expect(palette.link).toBe(palette.color);
    }
    expect(customColors("invalid").background).toBe("#fafaf5");
  });
});
