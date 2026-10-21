const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { FontManager } = require('../dist/main/main/fonts.js');
(async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'epub-offline-ui-'));
  const fonts = new FontManager(path.join(root, 'Data/fonts'));
  const installed = await fonts.install('atkinson-hyperlegible');
  await fs.writeFile(path.resolve(__dirname, '../release-artifacts/offline-ui-setup.json'), JSON.stringify({ root, preparedAt: new Date().toISOString(), preDownloadedFont: installed, librarySeeded: false }, null, 2));
  console.log('Isolated offline UI data:', root);
})().catch(error => { console.error(error.message); process.exitCode = 1; });
