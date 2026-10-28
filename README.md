# Leaf — Windows EPUB Reader

A desktop EPUB reader for Windows x64, with a visual library, saved reading positions, continuous and paginated reading, reading themes, and optional German-to-English translation through local Ollama or user-owned cloud accounts.

## Install and update

Download `WindowsEpubReaderSetup.exe` from this repository's **Releases** and run it. Close an older running version first. The installer upgrades the existing Windows EPUB Reader installation and keeps its library, reading positions, preferences, and downloaded fonts. Original EPUB files remain in their own locations.

In version 0.2.1 and later, **Settings → App updates** displays the installed version. Choose **Check for updates** to look for and download a newer release, then **Restart and install** once it is ready. Version 0.2.0 has these controls under **Settings → About**. Reading works offline; checking for app updates requires an internet connection.

Windows installers are currently unsigned. Development builds and builds without a configured release repository show manual upgrade instructions.

## Choose a page layout

In **Settings → Reading appearance**, or the **Reading appearance** controls inside a book, select **Page by page**. It defaults to **Single page**, an undivided reading area with page turns. Choose **Two pages** under **Page layout** for a side-by-side spread on wide windows; narrow windows show one page. The layout is saved globally across books and restarts, including when you switch to Scroll and back. Changing layout keeps your logical reading passage as closely as possible.

## Choose a reading background

Open **Settings → Reading appearance**, or **Reader settings** inside a book. Under **Page theme**, choose **Background** or **Font** above the shared color wheel, choose a hue and saturation, adjust **Brightness**, then choose **Apply background color** or **Apply font color**. The preview shows both colors together. You can also enter an exact six-digit hex color such as `#dce8da`. Applying a font color keeps the current page background; applying a background keeps your custom font color, if set. **Use automatic font color** restores contrasting black or white text.

The wheel supports keyboard input: Left/Right changes hue, Up/Down changes saturation, and Shift makes larger adjustments. Brightness and hex color are keyboard-accessible too.

Your applied colors are saved on this device and used for every book in both reading modes. System, Light, Dark, and Sepia use their own colors and retain your last custom colors for reuse. The library and Settings keep their dark appearance.

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

Translation is optional. For local translation, start Ollama and install `hf.co/tencent/Hy-MT2-7B-GGUF:Q4_K_M`, select local Ollama in **Reader settings / Translation** while reading, then explicitly load the model. Select a German passage in a book and choose Translate.

The E07 development implementation also supports your own Microsoft Translator and DeepL accounts, with exhaustion-only fallback that saves and keeps the new current provider. See [cloud setup and privacy](docs/product/CLOUD-TRANSLATION-SETUP.md) and [delivery/qualification status](docs/product/epics/E07-optional-cloud-translation.md). This does not claim the feature is present in a published installer or qualified against real provider accounts.

The in-book **Reader settings** panel combines appearance controls, translation-service selection, status, and local Load/Unload. Cloud account credentials remain in the main **Settings / Translation** screen. Amazon Translate was removed from scope on 2026-10-25; migration on the first translation-provider state read deletes its saved app-owned credentials and allowance metadata. If it was selected, choose a supported provider explicitly.

Use the [agent guidelines](docs/workflow/AGENT-GUIDELINES.md#setup-and-commands) for setup and verification. Start with the [documentation map](docs/README.md) for task-specific guides, the [product definition](docs/product/PRODUCT.md), and the [roadmap](docs/product/ROADMAP.md). See the [release workflow](docs/workflow/RELEASE-WORKFLOW.md) for distribution and [update instructions](docs/release/UPDATES.md) for installation and the [design guide](docs/design/README.md) for UI work. Agent sessions start with [AGENTS.md](AGENTS.md).
