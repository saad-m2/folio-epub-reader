module.exports = {
  packagerConfig: {
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
      FileDescription: "A hardened local EPUB reader",
      OriginalFilename: "WindowsEpubReader.exe",
      ProductName: "Windows EPUB Reader",
      InternalName: "WindowsEpubReader",
    },
  },
  makers: [
    {
      name: "@electron-forge/maker-squirrel",
      config: {
        name: "WindowsEpubReader",
        setupExe: "WindowsEpubReaderSetup.exe",
        noMsi: true,
      },
      platforms: ["win32"],
    },
  ],
  publishers: [],
};
