declare module "epubjs" {
  interface Book {
    opened?: Promise<unknown>;
    ready: Promise<unknown>;
    packaging?: { metadata?: Record<string, unknown> };
    navigation?: { toc?: NavigationItem[] };
    spine?: { first?: { href: string }; get(href: string): unknown };
    locations?: { locationFromCfi?(cfi: string): number };
    getRange(cfi: string): Promise<unknown>;
    load(href: string): Promise<{ body?: { textContent?: string | null } } | undefined>;
    destroy(): void;
  }
  interface NavigationItem { id?: string; label?: string; href?: string; subitems?: NavigationItem[]; }
  interface Rendition {
    destroy(): void;
    display(target: string): Promise<void>;
    next(): Promise<void>;
    prev(): Promise<void>;
    on(event: "relocated", handler: () => void): void;
    themes: {
      register(name: string, stylesheet: string): void;
      select(name: string): void;
    };
    currentLocation(): LocationObject | LocationObject[] | undefined;
    q?(selector: string): Promise<HTMLElement | null>;
  }
  interface LocationObject { start?: CfiLocation; end?: CfiLocation; }
  interface CfiLocation { cfi?: string; href?: string; percentage?: number; }
  interface BookOptions { encoding?: string; replacements?: string; }
  const ePub: (input: string | ArrayBuffer, options?: BookOptions) => Book;
  export default ePub;
}
