// Development-only smoke harness: isolated app data and a headless renderer.
const { app, BrowserWindow, dialog } = require('electron');
app.disableHardwareAcceleration();
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'overdrive-smoke-'));
app.setPath('userData', scratch);
app.requestSingleInstanceLock = () => true; // No OS singleton socket in this isolated harness.
const errors = [];
let finished = false;
const timer = setTimeout(() => { console.error('Smoke timed out'); app.exit(1); }, 20000);
dialog.showErrorBox = (_title, message) => { console.error(message); app.exit(1); };
app.on('web-contents-created', (_event, contents) => {
  contents.on('console-message', (_event, level, message) => { if (level >= 3) errors.push(message); });
  contents.on('did-finish-load', async () => {
    if (finished) return;
    try {
      // Wait on renderer evidence, not a fixed sleep.
      for (let i = 0; i < 100; i++) {
        if (await contents.executeJavaScript("document.body.innerText.includes('Bring your catalog')")) break;
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      const empty = await contents.executeJavaScript('document.body.innerText');
      if (!empty.includes('Bring your catalog')) throw new Error('Empty-catalog screen is missing');
      if (finished) return;
      finished = true;
      fs.writeFileSync(path.join(scratch, 'catalog.json'), JSON.stringify([{ id: 'demo', title: 'Smoke test game', shortDescription: 'Local rendering test', genres: ['Adventure'], downloadUrl: 'https://example.com/demo.zip' }]));
      // Production catalog is in memory, so the import dialog is exercised to update it.
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path.join(scratch, 'catalog.json')] });
      const imported = await contents.executeJavaScript('window.overdrive.importCatalog()');
      if (!imported) throw new Error('Import bridge failed');
      await contents.executeJavaScript('location.reload()');
      contents.once('did-finish-load', async () => {
        try {
          for(let i=0;i<100;i++) { if(await contents.executeJavaScript("document.body.innerText.includes('Smoke test game')")) break; await new Promise(r=>setTimeout(r,50)); }
          const body=await contents.executeJavaScript('document.body.innerText');
          if(!body.includes('Smoke test game')) throw new Error('Imported catalog did not populate storefront');
          await contents.executeJavaScript("location.hash = '#/game/demo'");
          for(let i=0;i<100;i++) { if(await contents.executeJavaScript("document.body.innerText.includes('Download file')")) break; await new Promise(r=>setTimeout(r,50)); }
          if(!await contents.executeJavaScript("document.body.innerText.includes('Download file')")) throw new Error('Game detail download action missing');
          if(errors.length) throw new Error(errors.join('\n'));
          console.log('SMOKE PASS: empty state, real import IPC, populated catalog, detail page, download action.');
          clearTimeout(timer); app.exit(0);
        } catch(err) { console.error(err); app.exit(1); }
      });
    } catch(err) { console.error(err); app.exit(1); }
  });
});
require('./main.cjs');
