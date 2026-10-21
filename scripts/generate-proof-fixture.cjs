const fs = require("node:fs/promises");
const path = require("node:path");
const JSZip = require("jszip");

async function fixtureBytes(zip) {
  for (const entry of Object.values(zip.files)) entry.date = new Date("2026-01-01T00:00:00Z");
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

async function main() {
  const zip = new JSZip();
  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });
  zip.file("META-INF/container.xml", `<?xml version="1.0"?><container><rootfiles><rootfile full-path="OEBPS/package.opf"/></rootfiles></container>`);
  zip.file("OEBPS/package.opf", `<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" xmlns:dc="http://purl.org/dc/elements/1.1/" version="2.0" unique-identifier="id"><metadata><dc:title>Deep marker proof</dc:title><dc:identifier id="id">proof-deep-marker</dc:identifier></metadata><manifest><item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/><item id="chapter" href="chapter.xhtml" media-type="application/xhtml+xml"/><item id="css" href="book.css" media-type="text/css"/><item id="image" href="pixel.png" media-type="image/png"/><item id="font" href="proof.ttf" media-type="font/ttf"/></manifest><spine toc="ncx"><itemref idref="chapter"/></spine></package>`);
  zip.file("OEBPS/toc.ncx", `<ncx><navMap><navPoint id="two"><navLabel><text>Two</text></navLabel><content src="chapter.xhtml#two-mid"/></navPoint></navMap></ncx>`);
  zip.file("OEBPS/book.css", "@font-face { font-family: ProofFont; src: url('proof.ttf'); } body { font-family: ProofFont, serif; } #two-mid { color: #234; }");
  zip.file("OEBPS/pixel.png", "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl7l+0AAAAASUVORK5CYII=", { base64: true });
  const fontPath = path.join(__dirname, "..", "tests", "assets", "LiberationSans-Regular.ttf");
  zip.file("OEBPS/proof.ttf", await fs.readFile(fontPath));
  zip.file("OEBPS/chapter.xhtml", `<html><head><link rel="stylesheet" href="book.css"/></head><body><script>document.body.dataset.scriptRan = 'yes'</script><form action="https://example.invalid"><input name="blocked"/></form><a href="file:///not-allowed">Blocked file URL</a><h1>Proof</h1><img src="pixel.png" alt="Proof pixel"/><p id="two-mid">The deep marker is reachable through the trusted local handoff.</p></body></html>`);
  const fixtureDirectory = path.join(__dirname, "..", "tests", "fixtures");
  await fs.mkdir(fixtureDirectory, { recursive: true });
  await fs.writeFile(path.join(fixtureDirectory, "deep-marker.epub"), await fixtureBytes(zip));

  const interaction = new JSZip();
  interaction.file("mimetype", "application/epub+zip", { compression: "STORE" });
  interaction.file("META-INF/container.xml", `<?xml version="1.0"?><container><rootfiles><rootfile full-path="OEBPS/package.opf"/></rootfiles></container>`);
  interaction.file("OEBPS/package.opf", `<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" xmlns:dc="http://purl.org/dc/elements/1.1/" version="2.0" unique-identifier="id"><metadata><dc:title>Reader interaction smoke</dc:title><dc:identifier id="id">reader-interaction-smoke</dc:identifier></metadata><manifest><item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/><item id="first" href="first.xhtml" media-type="application/xhtml+xml"/><item id="second" href="second.xhtml" media-type="application/xhtml+xml"/></manifest><spine toc="ncx"><itemref idref="first"/><itemref idref="second"/></spine></package>`);
  interaction.file("OEBPS/toc.ncx", `<ncx><navMap><navPoint id="first"><navLabel><text>First section</text></navLabel><content src="first.xhtml"/></navPoint><navPoint id="second"><navLabel><text>Second section</text></navLabel><content src="second.xhtml"/></navPoint></navMap></ncx>`);
  const passages = Array.from({ length: 30 }, (_, index) => `<p id="passage-${index}">Passage ${index + 1}. This paragraph has enough readable text to test page turns, line wrapping, and selection across several lines. The reading surface should preserve the selected passage while its own controls appear.</p>`).join("");
  interaction.file("OEBPS/first.xhtml", `<html><head><title>First section</title></head><body><h1>First section</h1><p><a href="https://example.invalid/reader-smoke">External HTTPS example</a> and <a href="http://example.invalid/blocked">blocked HTTP example</a>.</p>${passages}</body></html>`);
  interaction.file("OEBPS/second.xhtml", `<html><head><title>Second section</title></head><body><h1>Second section</h1><p>The next section confirms chapter navigation and stable progress.</p>${passages}</body></html>`);
  await fs.writeFile(path.join(fixtureDirectory, "interaction-smoke.epub"), await fixtureBytes(interaction));

  const epub3 = new JSZip();
  epub3.file("mimetype", "application/epub+zip", { compression: "STORE" });
  epub3.file("META-INF/container.xml", `<?xml version="1.0"?><container><rootfiles><rootfile full-path="EPUB/package.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`);
  epub3.file("EPUB/package.opf", `<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" xmlns:dc="http://purl.org/dc/elements/1.1/" version="3.0" unique-identifier="id"><metadata><dc:identifier id="id">epub3-nested-nav</dc:identifier><dc:title>Nested EPUB 3</dc:title><dc:creator>Fixture author</dc:creator><meta property="dcterms:modified">2026-01-01T00:00:00Z</meta></metadata><manifest><item id="nav" href="nav.xhtml" properties="nav" media-type="application/xhtml+xml"/><item id="one" href="one.xhtml" media-type="application/xhtml+xml"/><item id="two" href="two.xhtml" media-type="application/xhtml+xml"/><item id="css" href="style.css" media-type="text/css"/><item id="image" href="pixel.png" media-type="image/png"/></manifest><spine><itemref idref="one"/><itemref idref="two"/></spine></package>`);
  epub3.file("EPUB/nav.xhtml", `<html xmlns="http://www.w3.org/1999/xhtml"><body><nav epub:type="toc" xmlns:epub="http://www.idpf.org/2007/ops"><ol><li><a href="one.xhtml">First</a><ol><li><a href="one.xhtml#inner">Inner fragment</a></li></ol></li><li><a href="two.xhtml">Second</a></li></ol></nav></body></html>`);
  epub3.file("EPUB/style.css", "body { line-height: 1.5; } img { max-width: 100%; }");
  epub3.file("EPUB/pixel.png", "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl7l+0AAAAASUVORK5CYII=", { base64: true });
  epub3.file("EPUB/one.xhtml", `<html xmlns="http://www.w3.org/1999/xhtml"><head><link rel="stylesheet" href="style.css"/></head><body><h1>First</h1><p id="inner">Nested navigation resolves inside the first chapter.</p><img src="pixel.png" alt="Pixel"/></body></html>`);
  epub3.file("EPUB/two.xhtml", `<html xmlns="http://www.w3.org/1999/xhtml"><body><h1>Second</h1><p>Another spine item.</p></body></html>`);
  await fs.writeFile(path.join(fixtureDirectory, "epub3-nested-nav.epub"), await fixtureBytes(epub3));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
