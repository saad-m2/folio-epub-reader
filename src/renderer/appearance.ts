import type { Appearance } from "../shared/contracts";

export type Hsv = { hue: number; saturation: number; value: number };
export const defaultBackground = "#fafaf5";

export function hsvToHex({ hue, saturation, value }: Hsv): string {
  const channel = (offset: number): string => {
    const k = (offset + hue / 60) % 6;
    return Math.round(255 * value * (1 - saturation * Math.max(0, Math.min(k, 4 - k, 1))))
      .toString(16).padStart(2, "0");
  };
  return `#${channel(5)}${channel(3)}${channel(1)}`;
}

export function hexToHsv(hex: string): Hsv {
  const [r, g, b] = [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16) / 255);
  const value = Math.max(r, g, b);
  const delta = value - Math.min(r, g, b);
  const sector = delta === 0 ? 0 : value === r ? (g - b) / delta : value === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
  return { hue: ((sector * 60) + 360) % 360, saturation: value === 0 ? 0 : delta / value, value };
}

export function customColors(background: string, fontColor?: string): { background: string; color: string; link: string; visited: string } {
  // These colors are also interpolated into EPUB CSS.
  if (!/^#[0-9a-fA-F]{6}$/.test(background)) background = defaultBackground;
  const channels = [1, 3, 5].map(index => {
    const value = parseInt(background.slice(index, index + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  const luminance = channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  const color = fontColor && /^#[0-9a-fA-F]{6}$/.test(fontColor) ? fontColor : luminance > 0.179 ? "#000000" : "#ffffff";
  return { background, color, link: color, visited: color };
}

export function appearanceColors(appearance: Appearance, systemDark = false): ReturnType<typeof customColors> {
  if (appearance.theme === "custom") return customColors(appearance.backgroundColor ?? defaultBackground, appearance.fontColor);
  const theme = appearance.theme === "system" ? (systemDark ? "dark" : "light") : appearance.theme;
  if (theme === "dark") return { background: "#20251f", color: "#d4d9cb", link: "#9ccbff", visited: "#cab2ff" };
  if (theme === "sepia") return { background: "#eee7d8", color: "#3b4035", link: "#254f82", visited: "#684281" };
  return { background: defaultBackground, color: "#30372e", link: "#0645ad", visited: "#663399" };
}
