const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { KytyLauncher, validateTarget, validateExecutable, localCatalogEntry } = require('./kyty.cjs');
function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(),'kyty-test-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const exe = path.join(dir,'kyty_emulator.exe'); fs.writeFileSync(exe,'executable fixture');
  const game = path.join(dir,'Game folder with spaces & $ characters'); fs.mkdirSync(game); fs.writeFileSync(path.join(game,'eboot.bin'),'game fixture');
  return {dir,exe,game,state:path.join(dir,'kyty.json')};
}
test('accepts extracted eboot roots and .zar, rejects archives and launcher.exe', t=>{
 const f=fixture(t); assert.equal(validateTarget(f.game),f.game); assert.equal(validateExecutable(f.exe),f.exe);
 for(const ext of ['zip','rar','pkg','exfat']) { const file=path.join(f.dir,'game.'+ext); fs.writeFileSync(file,'x'); assert.throws(()=>validateTarget(file)); }
 const zar=path.join(f.dir,'game.zar'); fs.writeFileSync(zar,'x'); assert.equal(validateTarget(zar),zar);
 const wrong=path.join(f.dir,'launcher.exe'); fs.writeFileSync(wrong,'x'); assert.throws(()=>validateExecutable(wrong));
});
test('requires actual files and keeps link/configuration after restart',t=>{
 const f=fixture(t); const k=new KytyLauncher(f.state); k.configure(f.exe); k.link({id:'PPSA12345',platform:'ps5'},f.game);
 assert.equal(new KytyLauncher(f.state).snapshot().linked.PPSA12345,f.game);
 assert.throws(()=>validateTarget(f.dir)); assert.throws(()=>validateTarget('relative/path'));
 fs.unlinkSync(path.join(f.game,'eboot.bin')); assert.throws(()=>validateTarget(f.game));
});
test('blocks PS4 catalog entries and PS4 title metadata',t=>{
 const f=fixture(t); const k=new KytyLauncher(f.state);
 assert.throws(()=>k.link({id:'CUSA12345',platform:'ps4'},f.game));
 fs.mkdirSync(path.join(f.game,'sce_sys')); fs.writeFileSync(path.join(f.game,'sce_sys','param.json'),JSON.stringify({titleId:'CUSA12345'})); assert.throws(()=>validateTarget(f.game));
});
test('adds a stable local storefront entry using PS5 metadata',t=>{
 const f=fixture(t); fs.mkdirSync(path.join(f.game,'sce_sys')); fs.writeFileSync(path.join(f.game,'sce_sys','param.json'),JSON.stringify({titleId:'PPSA12345',localizedParameters:{'en-US':{titleName:'My local PS5 game'}}}));
 const a=localCatalogEntry(f.game); assert.equal(a.title,'My local PS5 game'); assert.equal(a.id,localCatalogEntry(f.game).id); assert.equal(a.platform,'ps5');
});
test('launch uses separate arguments, installation cwd, records exits and guards duplicate runs',async t=>{
 const f=fixture(t); let captured; const child=new EventEmitter(); child.stdout=new EventEmitter(); child.stderr=new EventEmitter(); child.pid=42;
 const k=new KytyLauncher(f.state,{platform:'win32',spawnImpl:(exe,args,options)=>{captured={exe,args,options}; queueMicrotask(()=>child.emit('spawn')); return child;}});
 k.configure(f.exe); const game={id:'PPSA12345',title:'Test',platform:'ps5'}; k.link(game,f.game); await k.launch(game);
 assert.deepEqual(captured.args,['--game',f.game]); assert.equal(captured.options.shell,false); assert.equal(captured.options.cwd,path.dirname(f.exe));
 await assert.rejects(k.launch(game),/already/); child.stderr.emit('data',Buffer.from('fixture error')); child.emit('close',1,null);
 assert.equal(k.snapshot().lastLaunch.status,'failed'); assert.equal(k.snapshot().lastLaunch.exitCode,1); assert.equal(k.snapshot().lastLaunch.log,'fixture error');
});
test('spawn errors surface and clear active state rather than claiming success',async t=>{
 const f=fixture(t); const k=new KytyLauncher(f.state,{platform:'win32',spawnImpl:()=>{const child=new EventEmitter();queueMicrotask(()=>child.emit('error',new Error('Missing DLL')));return child;}});
 k.configure(f.exe); const game={id:'PPSA12345',title:'Test',platform:'ps5'}; k.link(game,f.game); await assert.rejects(k.launch(game),/Missing DLL/);assert.equal(k.active.size,0);assert.equal(k.snapshot().lastLaunch.status,'failed');
});
