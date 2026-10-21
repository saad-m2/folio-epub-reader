import JSZip from "jszip";
import { limits } from "../shared/contracts";

export type PublicationValidationCode = "INVALID_EPUB" | "UNSUPPORTED_EPUB";

export class PublicationValidationError extends Error {
  constructor(readonly code: PublicationValidationCode) {
    super(code);
  }
}

export type CoverInfo = { mime: "image/jpeg" | "image/png" | "image/webp"; data: string };

function requireMatch(source: string, expression: RegExp): RegExpMatchArray {
  const match = source.match(expression);
  if (!match) throw new PublicationValidationError("INVALID_EPUB");
  return match;
}

function unsupportedIf(condition: boolean): void {
  if (condition) throw new PublicationValidationError("UNSUPPORTED_EPUB");
}

function validateXml(source: string, rootName: string): void {
  unsupportedIf(/<!\s*(?:DOCTYPE|ENTITY)\b/i.test(source));
  const document = new DOMParser().parseFromString(source, "application/xml");
  if (document.getElementsByTagName("parsererror").length || document.documentElement?.localName !== rootName) {
    throw new PublicationValidationError("INVALID_EPUB");
  }
}

async function extractCover(archive: JSZip, packagePath: string): Promise<CoverInfo | undefined> {
  let packageXml: string;
  try { packageXml = await archive.file(packagePath)?.async("text") ?? ""; } catch { return undefined; }
  if (!packageXml) return undefined;

  const xml = new DOMParser().parseFromString(packageXml, "application/xml");
  if (xml.getElementsByTagName("parsererror").length) return undefined;
  const elements = Array.from(xml.getElementsByTagName("*"));
  const coverId = elements.find(element => element.localName === "meta" && element.getAttribute("name")?.toLowerCase() === "cover")?.getAttribute("content");
  const item = elements.find(element => element.localName === "item" && (
    (coverId && element.getAttribute("id") === coverId)
    || element.getAttribute("properties")?.split(/\s+/).includes("cover-image")
  ));
  const coverHref = item?.getAttribute("href");
  if (!coverHref) return undefined;

  const base = new URL(`https://archive.invalid/${packagePath}`);
  let coverPath: string;
  try {
    const resolved = new URL(coverHref, base);
    if (resolved.origin !== base.origin) return undefined;
    coverPath = decodeURIComponent(resolved.pathname.slice(1));
  } catch { return undefined; }
  const coverFile = archive.file(coverPath);
  if (!coverFile) return undefined;

  const coverBytes = await coverFile.async("uint8array");
  if (coverBytes.byteLength > limits.maxEntryBytes) return undefined;
  const mime = item?.getAttribute("media-type");
  if (mime !== "image/jpeg" && mime !== "image/png" && mime !== "image/webp") return undefined;
  let binary = "";
  for (let offset = 0; offset < coverBytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...coverBytes.subarray(offset, offset + 0x8000));
  }
  return { mime, data: btoa(binary) };
}

export async function validatePublicationProfile(archiveBytes: ArrayBuffer): Promise<void> {
  let archive: JSZip;
  try { archive = await JSZip.loadAsync(archiveBytes); } catch { throw new PublicationValidationError("INVALID_EPUB"); }
  const container = archive.file("META-INF/container.xml");
  const encryption = archive.file("META-INF/encryption.xml");
  unsupportedIf(Boolean(encryption));
  if (!container) throw new PublicationValidationError("INVALID_EPUB");

  let containerXml: string;
  try { containerXml = await container.async("text"); } catch { throw new PublicationValidationError("INVALID_EPUB"); }
  validateXml(containerXml, "container");
  const packagePath = requireMatch(containerXml, /<rootfile\b[^>]*\bfull-path\s*=\s*["']([^"']+)["']/i)[1]!;
  const packageFile = archive.file(packagePath);
  if (!packageFile) throw new PublicationValidationError("INVALID_EPUB");

  let packageXml: string;
  try { packageXml = await packageFile.async("text"); } catch { throw new PublicationValidationError("INVALID_EPUB"); }
  validateXml(packageXml, "package");
  unsupportedIf(
    /\brendition:layout\s*=\s*["']pre-paginated["']/i.test(packageXml)
    || /<meta\b[^>]*(?:property|name)\s*=\s*["']rendition:layout["'][^>]*(?:content\s*=\s*["']pre-paginated["']|>\s*pre-paginated\s*<)/i.test(packageXml)
    || /\bproperties\s*=\s*["'][^"']*\brendition:layout-pre-paginated\b/i.test(packageXml)
    || /\bmedia-overlay\s*=/i.test(packageXml)
    || /\bmedia-type\s*=\s*["']application\/smil\+xml["']/i.test(packageXml)
    || /\bmedia:duration\b/i.test(packageXml)
    || /\bproperties\s*=\s*["'][^"']*\bscripted\b/i.test(packageXml),
  );
}

export async function validateAndExtractCover(archiveBytes: ArrayBuffer): Promise<CoverInfo | undefined> {
  let archive: JSZip;
  try { archive = await JSZip.loadAsync(archiveBytes); } catch { throw new PublicationValidationError("INVALID_EPUB"); }
  const container = archive.file("META-INF/container.xml");
  const encryption = archive.file("META-INF/encryption.xml");
  unsupportedIf(Boolean(encryption));
  if (!container) throw new PublicationValidationError("INVALID_EPUB");

  let containerXml: string;
  try { containerXml = await container.async("text"); } catch { throw new PublicationValidationError("INVALID_EPUB"); }
  validateXml(containerXml, "container");
  const packagePath = requireMatch(containerXml, /<rootfile\b[^>]*\bfull-path\s*=\s*["']([^"']+)["']/i)[1]!;
  const packageFile = archive.file(packagePath);
  if (!packageFile) throw new PublicationValidationError("INVALID_EPUB");

  let packageXml: string;
  try { packageXml = await packageFile.async("text"); } catch { throw new PublicationValidationError("INVALID_EPUB"); }
  validateXml(packageXml, "package");
  unsupportedIf(
    /\brendition:layout\s*=\s*["']pre-paginated["']/i.test(packageXml)
    || /<meta\b[^>]*(?:property|name)\s*=\s*["']rendition:layout["'][^>]*(?:content\s*=\s*["']pre-paginated["']|>\s*pre-paginated\s*<)/i.test(packageXml)
    || /\bproperties\s*=\s*["'][^"']*\brendition:layout-pre-paginated\b/i.test(packageXml)
    || /\bmedia-overlay\s*=/i.test(packageXml)
    || /\bmedia-type\s*=\s*["']application\/smil\+xml["']/i.test(packageXml)
    || /\bmedia:duration\b/i.test(packageXml)
    || /\bproperties\s*=\s*["'][^"']*\bscripted\b/i.test(packageXml),
  );
  return extractCover(archive, packagePath);
}
