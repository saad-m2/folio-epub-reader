import React, { useEffect, useId, useState } from "react";
import { customColors, hexToHsv, hsvToHex, type Hsv } from "./appearance";

export function ColorWheel({ color, active, apply, target = "background", backgroundColor = color, fontColor }: {
  color: string;
  active: boolean;
  apply: (color: string) => void;
  target?: "background" | "font";
  backgroundColor?: string;
  fontColor?: string;
}): React.ReactElement {
  const [hsv, setHsv] = useState(() => hexToHsv(color));
  const [hex, setHex] = useState(color);
  const helpId = useId();
  useEffect(() => { setHsv(hexToHsv(color)); setHex(color); }, [color]);
  const selected = hsvToHex(hsv);
  const preview = customColors(target === "background" ? selected : backgroundColor, target === "font" ? selected : fontColor);
  function change(next: Hsv): void { setHsv(next); setHex(hsvToHex(next)); }
  function point(event: React.PointerEvent<HTMLButtonElement>): void {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left - bounds.width / 2) / (bounds.width / 2);
    const y = (event.clientY - bounds.top - bounds.height / 2) / (bounds.height / 2);
    change({ ...hsv, hue: (Math.atan2(y, x) * 180 / Math.PI + 360) % 360, saturation: Math.min(1, Math.hypot(x, y)) });
  }
  const angle = hsv.hue * Math.PI / 180;
  return (
    <div className="custom-color-picker">
      <p className="small" id={helpId}>Choose a {target} color. Use the wheel, adjust brightness, then apply.</p>
      <div className="color-picker-layout">
        <button
          type="button"
          className="color-wheel"
          role="slider"
          tabIndex={0}
          aria-label={`${target === "font" ? "Font" : "Background"} color wheel`}
          aria-describedby={helpId}
          aria-valuemin={0}
          aria-valuemax={359}
          aria-valuenow={Math.round(hsv.hue) % 360}
          aria-valuetext={`${selected}, hue ${Math.round(hsv.hue)} degrees, saturation ${Math.round(hsv.saturation * 100)} percent. Left and right change hue; up and down change saturation.`}
          onPointerDown={event => {
            if (event.button !== 0) return;
            event.currentTarget.focus();
            event.currentTarget.setPointerCapture(event.pointerId);
            point(event);
          }}
          onPointerMove={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) point(event); }}
          onKeyDown={event => {
            if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
            event.preventDefault();
            event.stopPropagation();
            const step = event.shiftKey ? 10 : 1;
            change({
              ...hsv,
              hue: event.key === "Home" ? 0 : event.key === "End" ? 359 : (hsv.hue + (event.key === "ArrowRight" ? step : event.key === "ArrowLeft" ? -step : 0) + 360) % 360,
              saturation: Math.max(0, Math.min(1, hsv.saturation + (event.key === "ArrowUp" ? step / 100 : event.key === "ArrowDown" ? -step / 100 : 0))),
            });
          }}
        >
          <span className="color-wheel-marker" style={{ left: `${50 + Math.cos(angle) * hsv.saturation * 50}%`, top: `${50 + Math.sin(angle) * hsv.saturation * 50}%` }} />
        </button>
        <div className="color-picker-values">
          <label>Brightness
            <input type="range" min={0} max={100} value={Math.round(hsv.value * 100)} onChange={event => change({ ...hsv, value: Number(event.target.value) / 100 })} />
          </label>
          <label>Hex color
            <input type="text" value={hex} maxLength={7} spellCheck={false} aria-invalid={!/^#[0-9a-fA-F]{6}$/.test(hex)} onChange={event => {
              const value = event.target.value;
              setHex(value);
              if (/^#[0-9a-fA-F]{6}$/.test(value)) setHsv(hexToHsv(value));
            }} />
          </label>
          <div className="custom-color-preview" style={{ background: preview.background, color: preview.color }} aria-label={`Custom color preview ${selected}`}>Aa · Your page</div>
          <button type="button" className="btn" disabled={!/^#[0-9a-fA-F]{6}$/.test(hex) || (active && selected.toLowerCase() === color.toLowerCase())} onClick={() => apply(selected)}>
            Apply {target} color
          </button>
        </div>
      </div>
      {active && <p className="small" role="status">Custom {target} color selected: {color}</p>}
    </div>
  );
}
