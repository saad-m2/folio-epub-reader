const fs = require("node:fs/promises");
const path = require("node:path");
const JSZip = require("jszip");

const out = path.join(__dirname, "..", "fixtures");
const container = `<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/package.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`;
const pixel = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl7l+0AAAAASUVORK5CYII=";

async function writeBook(name, files) {
  const zip = new JSZip();
  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });
  zip.file("META-INF/container.xml", container);
  for (const [filename, value] of Object.entries(files)) zip.file(filename, value, { base64: filename.endsWith(".png") });
  await fs.mkdir(out, { recursive: true });
  await fs.writeFile(path.join(out, name), await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", mimeType: "application/epub+zip" }));
}

const para = n => Array.from({ length: n }, (_, i) => `<p>Paragraph ${i + 1}. This is ordinary reflowable text used to exercise vertical scrolling, pagination, selection, and stable logical locations across presentation changes.</p>`).join("");

(async () => {
  await writeBook("ordinary-epub2.epub", {
    "OEBPS/package.opf": `<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" unique-identifier="id" version="2.0"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="id">spike-epub2</dc:identifier><dc:title>Ordinary EPUB 2</dc:title><dc:language>en</dc:language></metadata><manifest><item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/><item id="c1" href="chapter1.xhtml" media-type="application/xhtml+xml"/><item id="c2" href="chapter2.xhtml" media-type="application/xhtml+xml"/></manifest><spine toc="ncx"><itemref idref="c1"/><itemref idref="c2"/></spine></package>`,
    "OEBPS/toc.ncx": `<?xml version="1.0"?><ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1"><head/><docTitle><text>Ordinary EPUB 2</text></docTitle><navMap><navPoint id="n1" playOrder="1"><navLabel><text>First</text></navLabel><content src="chapter1.xhtml"/></navPoint><navPoint id="n2" playOrder="2"><navLabel><text>Second</text></navLabel><content src="chapter2.xhtml"/></navPoint></navMap></ncx>`,
    "OEBPS/chapter1.xhtml": `<html xmlns="http://www.w3.org/1999/xhtml"><head><title>First</title></head><body><h1>First chapter</h1>${para(18)}</body></html>`,
    "OEBPS/chapter2.xhtml": `<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Second</title></head><body><h1>Second chapter</h1>${para(18)}</body></html>`,
  });
  await writeBook("toc-and-images.epub", {
    "OEBPS/package.opf": `<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" unique-identifier="id" version="3.0"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="id">spike-toc-images</dc:identifier><dc:title>TOC, Images, and Author CSS</dc:title><dc:language>en</dc:language><meta property="dcterms:modified">2026-09-16T00:00:00Z</meta></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="css" href="book.css" media-type="text/css"/><item id="img" href="image.png" media-type="image/png"/><item id="shared" href="shared.xhtml" media-type="application/xhtml+xml"/><item id="tail" href="tail.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="shared"/><itemref idref="tail"/></spine></package>`,
    "OEBPS/nav.xhtml": `<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>Contents</title></head><body><nav epub:type="toc"><ol><li><a href="shared.xhtml#one">Part One</a><ol><li><a href="shared.xhtml#two">Nested Part Two</a></li></ol></li><li><a href="tail.xhtml">Part Three</a></li></ol></nav></body></html>`,
    "OEBPS/book.css": `body{font-family:Georgia,serif;line-height:1.65} h1{color:#914f28} img{display:block;max-width:80%;margin:1rem auto}`, 
    "OEBPS/image.png": pixel,
    "OEBPS/shared.xhtml": `<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Shared</title><link rel="stylesheet" href="book.css"/></head><body><section id="one"><h1>Part One</h1><img src="image.png" alt="Test image"/>${para(80)}</section><section id="two"><h1>Nested Part Two</h1>${Array.from({ length: 80 }, (_, i) => `<p${i === 55 ? ' id="two-mid"' : ""}>Nested paragraph ${i + 1}. This is ordinary reflowable text used to exercise vertical scrolling, pagination, selection, and stable logical locations across presentation changes.</p>`).join("")}</section></body></html>`,
    "OEBPS/tail.xhtml": `<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Tail</title><link rel="stylesheet" href="book.css"/></head><body><h1>Part Three</h1>${para(16)}</body></html>`,
  });
  await writeBook("awkward-security.epub", {
    "OEBPS/package.opf": `<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" unique-identifier="id" version="3.0"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="id">spike-security</dc:identifier><dc:title>Awkward Security Fixture</dc:title><dc:language>en</dc:language><meta property="dcterms:modified">2026-09-16T00:00:00Z</meta></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="c1" href="chapter.xhtml" media-type="application/xhtml+xml" properties="scripted"/></manifest><spine><itemref idref="c1"/></spine></package>`,
    "OEBPS/nav.xhtml": `<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><body><nav epub:type="toc"><ol><li><a href="chapter.xhtml">Awkward chapter</a></li></ol></nav></body></html>`,
    "OEBPS/chapter.xhtml": `<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Awkward</title><link rel="stylesheet" href="https://example.invalid/tracker.css"/><script>document.documentElement.dataset.scriptRan='yes';fetch('https://example.invalid/script-fetch')</script></head><body><h1>Awkward chapter</h1><img src="https://example.invalid/tracker.png" alt="remote request probe"/><form action="https://example.invalid/submit"><input value="must not submit"/><button>Submit</button></form><a href="https://example.invalid/navigation">External link probe</a>${para(24)}</body></html>`,
  });
})();
