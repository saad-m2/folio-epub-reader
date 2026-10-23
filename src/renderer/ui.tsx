import React, { forwardRef } from "react";
import type { Appearance, LibraryBook, PageLayout, ReaderMode } from "../shared/contracts";
import { ColorWheel } from "./color-wheel";
import { defaultBackground } from "./appearance";

const paths: Record<string, React.ReactNode> = {
  book: (
    <path d="M3 4c3-1 6-1 9 1 3-2 6-2 9-1v15c-3-1-6-1-9 1-3-2-6-2-9-1zM12 5v15" />
  ),
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </>
  ),
  settings: (
    <>
      <path d="m10 3-.7 3-2 .9-2.7-.9-2 3.5 2.1 2v2.3l-2.1 2 2 3.4 2.8-.9 2 1 .6 2.7h4l.6-3 2-.9 2.7.9 2-3.5-2.1-2v-2.3l2.1-2-2-3.4-2.8.9-2-1L14 3z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
  left: <path d="m14 6-6 6 6 6" />,
  right: <path d="m10 6 6 6-6 6" />,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  leaf: <path d="M19 3C8 2 2 7 5 15s17 6 14-12ZM5 20 16 8M10 14v-4m0 4h4" />,
  list: <path d="M8 5h13M8 12h13M8 19h13M3 5h.1M3 12h.1M3 19h.1" />,
  type: <path d="m2 19 6-14 6 14M4 15h8m4-5c7-3 6 3 6 6v3m0-6c-8-2-8 7-1 5" />,
  translate: (
    <path d="M3 5h12M9 2v3M5 5c1 6 4 9 8 11M13 5c-1 6-5 10-10 12m11 4 4-11 4 11m-6-4h4" />
  ),
  copy: (
    <>
      <rect x="8" y="8" width="12" height="13" rx="2" />
      <path d="M15 8V3H3v13h5" />
    </>
  ),
  expand: <path d="M14 3h7v7m0-7-8 8M10 21H3v-7m0 7 8-8" />,
  check: <path d="m5 12 4 4L19 6" />,
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6m0-10v.1" />
    </>
  ),
  file: <path d="M14 3H5v18h14V8zM14 3v6h5M8 13h8M8 17h5" />,
  warning: <path d="m12 3 10 18H2zM12 9v5m0 3v.1" />,
  download: <path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" />,
};

export function Icon({
  name,
  size = 19,
}: {
  name: string;
  size?: number;
}): React.ReactElement {
  return (
    <svg
      className="ico"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      {paths[name] ?? paths.book}
    </svg>
  );
}

export const Button = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    appearance?: "primary" | "subtle" | "secondary";
  }
>(function Button(
  { appearance, className = "", type = "button", ...props },
  ref,
) {
  return (
    <button
      {...props}
      type={type}
      ref={ref}
      className={`btn ${appearance === "primary" ? "primary" : appearance === "subtle" ? "ghost" : ""} ${className}`}
    />
  );
});

export function ModeSwitch({
  mode,
  onChange,
}: {
  mode: ReaderMode;
  onChange: (mode: ReaderMode) => void;
}): React.ReactElement {
  return (
    <div className="segmented" role="group" aria-label="Reading mode">
      <button
        type="button"
        aria-pressed={mode === "continuous"}
        onClick={() => onChange("continuous")}
      >
        Scroll
      </button>
      <button
        type="button"
        aria-pressed={mode === "paginated"}
        onClick={() => onChange("paginated")}
      >
        Page by page
      </button>
    </div>
  );
}

export function PageLayoutSwitch({ layout, onChange }: {
  layout: PageLayout;
  onChange: (layout: PageLayout) => void;
}): React.ReactElement {
  return (
    <div className="segmented" role="group" aria-label="Page layout">
      <button type="button" aria-pressed={layout === "single"} onClick={() => onChange("single")}>
        Single page
      </button>
      <button type="button" aria-pressed={layout === "double"} onClick={() => onChange("double")}>
        Two pages
      </button>
    </div>
  );
}

const bounds = {
  fontSize: [12, 36, 1],
  margin: [16, 120, 8],
  lineHeight: [1.1, 2.5, 0.1],
  paragraphSpacing: [0, 4, 0.1],
} as const;
export function AppearanceControls({
  appearance,
  update,
  fonts,
}: {
  appearance: Appearance;
  update: (next: Appearance) => void;
  fonts: string[];
}): React.ReactElement {
  const adjust = (key: keyof typeof bounds, direction: number): void => {
    const [min, max, step] = bounds[key];
    update({
      ...appearance,
      [key]: Math.min(
        max,
        Math.max(min, Number((appearance[key] + direction * step).toFixed(2))),
      ),
    });
  };
  return (
    <div className="appearance-controls">
      <fieldset className="theme-field">
        <legend>Page theme</legend>
        <div className="themes">
          {(["light", "sepia", "dark", "system"] as const).map((theme) => (
            <button
              type="button"
              key={theme}
              className={`theme theme-${theme}`}
              aria-pressed={appearance.theme === theme}
              onClick={() => update({ ...appearance, theme })}
            >
              <b aria-hidden="true">Aa</b>
              {theme[0].toUpperCase() + theme.slice(1)}
            </button>
          ))}
        </div>
        <ColorWheel
          color={appearance.backgroundColor ?? defaultBackground}
          active={appearance.theme === "custom"}
          apply={backgroundColor => update({ ...appearance, theme: "custom", backgroundColor })}
        />
      </fieldset>
      <label className="form-row">
        <span>Reading font</span>
        <select
          aria-label="Reading font"
          value={appearance.fontFamily}
          onChange={(event) =>
            update({ ...appearance, fontFamily: event.target.value })
          }
        >
          {fonts.map((font) => (
            <option key={font} value={font}>
              {font.replace(/ Reader$/, "")}
            </option>
          ))}
        </select>
      </label>
      {(
        [
          ["fontSize", "Text size", "px"],
          ["margin", "Page margins", "px"],
          ["lineHeight", "Line spacing", ""],
          ["paragraphSpacing", "Paragraph spacing", "em"],
        ] as const
      ).map(([key, label, unit]) => (
        <div className="form-row appearance-stepper" key={key}>
          <span>{label}</span>
          <div className="stepper">
            <button
              type="button"
              aria-label={`Decrease ${label.toLowerCase()}`}
              disabled={appearance[key] <= bounds[key][0]}
              onClick={() => adjust(key, -1)}
            >
              −
            </button>
            <output aria-label={label}>
              {appearance[key]}
              {unit}
            </output>
            <button
              type="button"
              aria-label={`Increase ${label.toLowerCase()}`}
              disabled={appearance[key] >= bounds[key][1]}
              onClick={() => adjust(key, 1)}
            >
              +
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

const palette = [
  ["#c5b994", "#323e32"],
  ["#203c4b", "#dfc68d"],
  ["#a85f48", "#f3dec0"],
  ["#304b3c", "#d4d4a3"],
  ["#c6b2b2", "#4f3a49"],
  ["#c79452", "#4b4230"],
  ["#384850", "#d0c9b4"],
  ["#7d8972", "#e7e3c9"],
];
export function BookCover({
  book,
}: {
  book: Pick<LibraryBook, "title" | "author" | "cover">;
}): React.ReactElement {
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => setFailed(false), [book.cover]);
  const hash = Array.from(book.title).reduce(
    (value, letter) => value + letter.charCodeAt(0),
    0,
  );
  const [background, color] = palette[hash % palette.length]!;
  return (
    <div className="cover">
      {book.cover && !failed ? (
        <img src={book.cover} alt="" onError={() => setFailed(true)} />
      ) : (
        <div
          className="cover-fallback"
          style={{ backgroundColor: background, color }}
          aria-hidden="true"
        >
          <div className="cover-border">
            <div className="fallback-title">{book.title}</div>
            <svg
              viewBox="0 0 160 160"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.1"
            >
              <circle cx="80" cy="80" r="46" />
              <circle cx="80" cy="80" r="35" opacity=".5" />
              <path d="M80 133V43m0 55c-34-1-43-21-36-34 24 1 34 18 36 34Zm0 18c33-2 43-22 36-36-24 1-35 19-36 36ZM80 67c-19-14-20-29 0-41 19 12 18 27 0 41Z" />
            </svg>
            <div className="fallback-author">{book.author}</div>
          </div>
        </div>
      )}
    </div>
  );
}
