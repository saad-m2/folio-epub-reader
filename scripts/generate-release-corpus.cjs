const fs = require('node:fs/promises');
const path = require('node:path');
const JSZip = require('jszip');
const { createHash } = require('node:crypto');

async function main() {
  const root = path.resolve(__dirname, '../tests/fixtures');
  const source = await fs.readFile(path.join(root, 'epub3-nested-nav.epub'));
  const entries = [];
  async function save(name, zip, expected, stress = false) {
    if (!Buffer.isBuffer(zip)) for (const entry of Object.values(zip.files)) entry.date = new Date('2026-01-01T00:00:00Z');
    const bytes = Buffer.isBuffer(zip) ? zip : await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    await fs.writeFile(path.join(root, name), bytes);
    entries.push({ name, expected, stress, sizeBytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
  }
  for (const name of ['deep-marker.epub', 'interaction-smoke.epub', 'epub3-nested-nav.epub']) {
    await save(name, await fs.readFile(path.join(root, name)), 'supported');
  }
  for (const [name, change, expected] of [
    ['fixed-layout.epub', xml => xml.replace('<metadata>', '<metadata><meta property="rendition:layout">pre-paginated</meta>'), 'UNSUPPORTED_EPUB'],
    ['scripted.epub', xml => xml.replace('id="one"', 'id="one" properties="scripted"'), 'UNSUPPORTED_EPUB'],
    ['media-overlay.epub', xml => xml.replace('id="one"', 'id="one" media-overlay="audio"'), 'UNSUPPORTED_EPUB'],
    ['malformed-package.epub', () => '<package><broken></package>', 'INVALID_EPUB'],
  ]) {
    const zip = await JSZip.loadAsync(source);
    zip.file('EPUB/package.opf', change(await zip.file('EPUB/package.opf').async('text')));
    await save(name, zip, expected);
  }
  const drm = await JSZip.loadAsync(source);
  drm.file('META-INF/encryption.xml', '<encryption/>');
  await save('drm.epub', drm, 'UNSUPPORTED_EPUB');
  const missing = await JSZip.loadAsync(source);
  missing.remove('EPUB/nav.xhtml');
  missing.file('EPUB/package.opf', (await missing.file('EPUB/package.opf').async('text')).replace(/<item id="nav"[^>]*\/>/, ''));
  await save('missing-navigation.epub', missing, 'supported');
  const stress = await JSZip.loadAsync(source);
  const paragraphs = Array.from({ length: 2500 }, (_, i) => `<p id="stress-${i}">Paragraph ${i}. Reading long local publications must retain position and remain responsive during layout changes. ${'Long text with different words and punctuation. '.repeat(4)}</p>`).join('');
  stress.file('EPUB/one.xhtml', `<html xmlns="http://www.w3.org/1999/xhtml"><body><h1>Stress chapter</h1>${paragraphs}</body></html>`);
  await save('stress.epub', stress, 'supported', true);
  const german = await JSZip.loadAsync(source);
  german.file('EPUB/one.xhtml', '<html xmlns="http://www.w3.org/1999/xhtml"><body><h1>Offline translation</h1><p>Guten Morgen! Heute scheint die Sonne.</p><p>Der Zug nach Berlin fährt um neun Uhr ab.</p></body></html>');
  german.file('EPUB/package.opf', (await german.file('EPUB/package.opf').async('text')).replace(/<dc:title>[^<]*<\/dc:title>/, '<dc:title>Offline German test</dc:title>').replace(/<dc:identifier([^>]*)>[^<]*<\/dc:identifier>/, '<dc:identifier$1>urn:epub-reader:offline-german</dc:identifier>'));
  await save('offline-german.epub', german, 'supported');
  await save('malformed-zip.epub', Buffer.from('not a ZIP archive'), 'INVALID_EPUB');
  await fs.writeFile(path.join(root, 'release-corpus.json'), JSON.stringify({ fixtures: entries }, null, 2));
  console.log(`Release corpus: ${entries.length} fixtures`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
