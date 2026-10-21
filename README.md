# Folio — Windows EPUB Reader

A desktop EPUB reader for Windows x64, with a visual library, saved reading positions, continuous and paginated reading, reading themes, and optional local German-to-English translation through Ollama.

## Install and update

Download `WindowsEpubReaderSetup.exe` from this repository's **Releases** and run it. Close an older running version first. The installer upgrades the existing Windows EPUB Reader installation and keeps its library, reading positions, preferences, and downloaded fonts. Original EPUB files remain in their own locations.

Settings → About displays the installed version. Builds configured for this repository can check and download updates when you choose **Check for updates**. Choose **Restart and install** once the download is ready. Reading works offline; checking for app updates requires an internet connection.

Windows installers are currently unsigned. Development builds and builds without a configured release repository show manual upgrade instructions.

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

See [release and update instructions](docs/UPDATES.md), [the product definition](docs/PRODUCT.md), and [the approved frontend design](design/frontend-a/README.md).
