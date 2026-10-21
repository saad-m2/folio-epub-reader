import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { PublicationValidationError, validatePublicationProfile, validateAndExtractCover, type CoverInfo } from "../src/renderer/publication-validation";

async function epub(packageXml: string, encrypted = false, cover?: { href: string; data: Uint8Array }): Promise<ArrayBuffer> {
  const archive = new JSZip();
  archive.file("mimetype", "application/epub+zip");
  archive.file("META-INF/container.xml", `<?xml version="1.0"?><container><rootfiles><rootfile full-path="OPS/package.opf"/></rootfiles></container>`);
  archive.file("OPS/package.opf", packageXml);
  if (cover) archive.file(`OPS/${cover.href}`, cover.data);
  if (encrypted) archive.file("META-INF/encryption.xml", "<encryption/>");
  const bytes = await archive.generateAsync({ type: "arraybuffer" });
  return bytes;
}

const ordinaryPackage = `<package version="3.0"><metadata><title>Ordinary</title></metadata><manifest><item id="chapter" href="chapter.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="chapter"/></spine></package>`;

const packageWithCoverMeta = `<package version="3.0"><metadata><title>With Cover</title><meta name="cover" content="cover-img"/></metadata><manifest><item id="cover-img" href="cover.jpg" media-type="image/jpeg"/><item id="chapter" href="chapter.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="chapter"/></spine></package>`;

const packageWithCoverProperty = `<package version="3.0"><metadata><title>With Cover Property</title></metadata><manifest><item id="cover-img" href="cover.png" media-type="image/png" properties="cover-image"/><item id="chapter" href="chapter.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="chapter"/></spine></package>`;

describe("publication profile validation", () => {
  it("accepts an ordinary reflowable package", async () => {
    await expect(validatePublicationProfile(await epub(ordinaryPackage))).resolves.toBeUndefined();
  });

  it.each([
    ["encrypted", ordinaryPackage, true],
    ["fixed-layout", ordinaryPackage.replace("<metadata>", "<metadata><meta property=\"rendition:layout\">pre-paginated</meta>"), false],
    ["scripted", ordinaryPackage.replace("media-type=\"application/xhtml+xml\"", "media-type=\"application/xhtml+xml\" properties=\"scripted\""), false],
    ["media-overlay", ordinaryPackage.replace("media-type=\"application/xhtml+xml\"", "media-type=\"application/xhtml+xml\" media-overlay=\"overlay\""), false],
  ])("rejects %s packages", async (_name, packageXml, encrypted) => {
    await expect(validatePublicationProfile(await epub(packageXml, encrypted))).rejects.toEqual(expect.objectContaining<Partial<PublicationValidationError>>({ code: "UNSUPPORTED_EPUB" }));
  });

  it("rejects a malformed package container", async () => {
    const archive = new JSZip();
    archive.file("META-INF/container.xml", "<container/>");
    await expect(validatePublicationProfile(await archive.generateAsync({ type: "arraybuffer" }))).rejects.toEqual(expect.objectContaining<Partial<PublicationValidationError>>({ code: "INVALID_EPUB" }));
  });
});

describe("cover extraction", () => {
  it("extracts cover via meta name=cover", async () => {
    const coverData = new Uint8Array([0xff, 0xd8, 0xff]); // JPEG magic bytes
    const cover = await validateAndExtractCover(await epub(packageWithCoverMeta, false, { href: "cover.jpg", data: coverData }));
    expect(cover).toEqual<CoverInfo>({ mime: "image/jpeg", data: Buffer.from(coverData).toString("base64") });
  });

  it("extracts cover via properties=cover-image", async () => {
    const coverData = new Uint8Array([0x89, 0x50, 0x4e, 0x47]); // PNG magic bytes
    const cover = await validateAndExtractCover(await epub(packageWithCoverProperty, false, { href: "cover.png", data: coverData }));
    expect(cover).toEqual<CoverInfo>({ mime: "image/png", data: Buffer.from(coverData).toString("base64") });
  });

  it("extracts a relative cover with attributes in a different order", async () => {
    const packageXml = `<package version="3.0"><metadata><meta content="cover-img" name="cover"/></metadata><manifest><item media-type="image/png" href="../Images/cover.png" id="cover-img"/></manifest><spine/></package>`;
    const archive = new JSZip();
    archive.file("META-INF/container.xml", `<container><rootfiles><rootfile full-path="OPS/Text/package.opf"/></rootfiles></container>`);
    archive.file("OPS/Text/package.opf", packageXml);
    archive.file("OPS/Images/cover.png", new Uint8Array([0x89, 0x50, 0x4e, 0x47]));
    const cover = await validateAndExtractCover(await archive.generateAsync({ type: "arraybuffer" }));
    expect(cover).toEqual({ mime: "image/png", data: "iVBORw==" });
  });

  it("returns undefined when no cover is declared", async () => {
    const cover = await validateAndExtractCover(await epub(ordinaryPackage));
    expect(cover).toBeUndefined();
  });

  it("returns undefined when cover file is missing", async () => {
    const cover = await validateAndExtractCover(await epub(packageWithCoverMeta));
    expect(cover).toBeUndefined();
  });
});
