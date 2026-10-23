# Leaf — Windows EPUB Reader

A desktop EPUB reader for Windows x64, with a visual library, saved reading positions, continuous and paginated reading, reading themes, and optional local German-to-English translation through Ollama.

## Install and update

Download `WindowsEpubReaderSetup.exe` from this repository's **Releases** and run it. Close an older running version first. The installer upgrades the existing Windows EPUB Reader installation and keeps its library, reading positions, preferences, and downloaded fonts. Original EPUB files remain in their own locations.

In version 0.2.1 and later, **Settings → App updates** displays the installed version. Choose **Check for updates** to look for and download a newer release, then **Restart and install** once it is ready. Version 0.2.0 has these controls under **Settings → About**. Reading works offline; checking for app updates requires an internet connection.

Windows installers are currently unsigned. Development builds and builds without a configured release repository show manual upgrade instructions.

## Choose a page layout

In **Settings → Reading appearance**, or the **Reading appearance** controls inside a book, select **Page by page**. It defaults to **Single page**, an undivided reading area with page turns. Choose **Two pages** under **Page layout** for a side-by-side spread on wide windows; narrow windows show one page. The layout is saved globally across books and restarts, including when you switch to Scroll and back. Changing layout keeps your logical reading passage as closely as possible.

## Choose a reading background

Open **Settings → Reading appearance**, or the **Reading appearance** controls inside a book. Under **Page theme**, use the color wheel to choose a hue and saturation, adjust **Brightness**, and choose **Apply custom color**. The preview shows the selected background with automatically contrasting text. You can also enter an exact six-digit hex color such as `#dce8da`.

The wheel supports keyboard input: Left/Right changes hue, Up/Down changes saturation, and Shift makes larger adjustments. Brightness and hex color are keyboard-accessible too.

Your applied color is saved on this device and used for every book in both reading modes. System, Light, Dark, and Sepia remain available, and switching to a preset retains your last custom color. The library and Settings keep their dark appearance.

## Develop

Requires Windows x64, Node.js 24, and pnpm 12.5.1.

```sh
pnpm install --frozen-lockfile
pnpm start
```

```sh
pnpm check
pnpm test
pnpm package:release
```

`package:release` builds and verifies the Squirrel installer, runs the packaged EPUB runtime tests, and produces dependency/license evidence. Installer output is in `out/make/squirrel.windows/x64/`.

Translation is optional. Start Ollama and install `hf.co/tencent/Hy-MT2-7B-GGUF:Q4_K_M`, then explicitly load the model in Settings → Local translation. Select a German passage in a book and choose Translate.

Start with the [documentation map](docs/README.md) for task-specific guides, the [product definition](docs/product/PRODUCT.md), and the [roadmap](docs/product/ROADMAP.md). See [release and update instructions](docs/release/UPDATES.md) for distribution and the [design guide](docs/design/README.md) for UI work. Agent sessions start with [AGENTS.md](AGENTS.md).
