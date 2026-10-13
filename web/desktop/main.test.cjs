const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const core = require('./core.cjs');

async function start(t, saved) {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'overdrive-start-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  fs.writeFileSync(path.join(dir,'settings.json'),JSON.stringify(saved));
  const handlers=new Map();
  const failures=[];
  let window, quit=false;
  class Window {
    constructor() {
      window=this;
      this.webContents={ mainFrame:{}, setWindowOpenHandler() {}, on() {}, session:{setPermissionRequestHandler() {}}, send() {} };
    }
    on() {}
    loadFile() {}
    isDestroyed() { return false; }
  }
  const electron={
    app:{requestSingleInstanceLock:()=>true,on() {},whenReady:()=>Promise.resolve(),getPath:()=>dir,quit() { quit=true; }},
    BrowserWindow:Window,
    ipcMain:{handle(name,fn) { handlers.set(name,fn); }},
    dialog:{showErrorBox(_title,message) { failures.push(message); }},
    shell:{}
  };
  const source=fs.readFileSync(path.join(__dirname,'main.cjs'),'utf8');
  vm.runInNewContext(source,{
    __dirname,
    require(name) {
      if (name==='electron') return electron;
      if (name==='./core.cjs') return {...core,DownloadManager:class { constructor() { this.active=new Map(); } }};
      if (name==='./kyty.cjs') return {KytyLauncher:class {}};
      return require(name);
    }
  });
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(failures,[]);
  assert.equal(quit,false);
  assert.ok(window);
  const settings=handlers.get('overdrive:settings')({sender:window.webContents,senderFrame:window.webContents.mainFrame});
  return {dir,settings};
}

test('startup recovers unexpected settings shapes and preserves their original contents', async t => {
  for (const saved of [null,[],42,true,'settings']) {
    const {dir,settings}=await start(t,saved);
    assert.equal(settings.folder,path.join(dir,'Overdrive'));
    const backups=fs.readdirSync(dir).filter(name=>name.startsWith('settings.json.damaged-'));
    assert.equal(backups.length,1);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir,backups[0]),'utf8')),saved);
  }
});

test('startup keeps valid settings and falls back for an invalid folder', async t => {
  for (const saved of [{folder:path.join(os.tmpdir(),'custom-downloads')},{folder:'relative'},{folder:42},{}]) {
    const {dir,settings}=await start(t,saved);
    assert.equal(settings.folder,typeof saved.folder==='string' && path.isAbsolute(saved.folder) ? saved.folder : path.join(dir,'Overdrive'));
    assert.equal(fs.readdirSync(dir).some(name=>name.startsWith('settings.json.damaged-')),false);
  }
});
