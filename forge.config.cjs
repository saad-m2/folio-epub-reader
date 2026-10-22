module.exports = {
  packagerConfig: {
    // Keep the existing package/output identity for installed-app upgrades.
    name: "windows-epub-reader",
    asar: true,
    // Renderer dependencies are compiled into Vite assets. Main requires only
    // zod; retain epub.js source as patch/provenance evidence as well.
    ignore: [/^[/\\](?!(?:dist|node_modules)(?:[/\\]|$)|package\.json$)/, /^[/\\]node_modules[/\\](?!(?:zod|epubjs)(?:[/\\]|$))/],
    arch: "x64",
    platform: "win32",
    executableName: "WindowsEpubReader",
    appCopyright: "Copyright (c) 2025 Windows EPUB Reader contributors",
    win32metadata: {
      CompanyName: "Windows EPUB Reader contributors",
      FileDescription: "Leaf EPUB reader",
      OriginalFilename: "WindowsEpubReader.exe",
      ProductName: "Leaf",
      InternalName: "WindowsEpubReader",
    },
  },
  makers: [
    {
      name: "@electron-forge/maker-squirrel",
      config: {
        name: "WindowsEpubReader",
        title: "Leaf",
        setupExe: "WindowsEpubReaderSetup.exe",
        noMsi: true,
      },
      platforms: ["win32"],
    },
  ],
  publishers: [],
};
