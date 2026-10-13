const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const { normalizeCatalog, DownloadManager } = require('./core.cjs');
const bytes = Buffer.from('A real download fixture, not simulated progress.');
const digest = crypto.createHash('sha256').update(bytes).digest('hex');
async function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'overdrive-test-'));
  const server = http.createServer((req,res) => {
    if (req.url === '/error') { res.writeHead(503); res.end('unavailable'); }
    else if (req.url === '/html') { res.writeHead(200, {'content-type':'text/html'}); res.end('<html>host page</html>'); }
    else if (req.url === '/redirect') { res.writeHead(302, {location:'/file'}); res.end(); }
    else if (req.url === '/slow') { res.writeHead(200, {'content-type':'application/octet-stream'}); res.write(bytes); const timer=setTimeout(()=>res.end(bytes),1000); res.on('close',()=>clearTimeout(timer)); }
    else { res.writeHead(200, {'content-type':'application/octet-stream','content-length':bytes.length}); res.end(bytes); }
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(async()=> { server.closeAllConnections(); await new Promise(resolve=>server.close(resolve)); fs.rmSync(dir,{recursive:true,force:true}); });
  const manager = new DownloadManager(path.join(dir,'history.json'),()=>{}, {allowHttp:true});
  return {manager,dir,url:`http://127.0.0.1:${server.address().port}`};
}
async function done(manager,id) {
  for(let i=0;i<300;i++) {const task=manager.list().find(x=>x.id===id); if(task.status!=='downloading') return task; await new Promise(r=>setTimeout(r,10));} throw new Error('Transfer did not finish');
}
test('catalog normalizes metadata and starts empty without private data',()=>{
  assert.deepEqual(normalizeCatalog([]),[]);
  const [g]=normalizeCatalog({games:[{id:'demo',title:'Demo',downloadUrl:'https://example.com/demo.zip'}]});
  assert.equal(g.slug,'demo'); assert.deepEqual(g.genres,[]); assert.equal(g.fileName,'demo.zip');
});
test('catalog rejects traversal, reserved filenames, duplicate IDs and unsafe URLs',()=>{
  for(const patch of [{fileName:'../evil.exe'},{fileName:'NUL.zip'},{fileName:'evil.zip.'},{downloadUrl:'file:///tmp/foo'},{downloadUrl:'https://user:password@example.com/x'},{sha256:'nope'}]) assert.throws(()=>normalizeCatalog([{id:'demo',title:'Demo',...patch}]));
  assert.throws(()=>normalizeCatalog([{id:'a',title:'A'},{id:'a',title:'B'}]));
});
test('real HTTP bytes, redirect, SHA-256 and history survive restart',async t=>{
  const {manager,dir,url}=await fixture(t); const task=manager.start({id:'demo',title:'Demo',fileName:'demo.zip',downloadUrl:url+'/redirect',sha256:digest},dir);
  const result=await done(manager,task.id); assert.equal(result.status,'completed'); assert.deepEqual(fs.readFileSync(result.destination),bytes); assert.equal(result.actualSha256,digest);
  assert.equal(new DownloadManager(path.join(dir,'history.json')).list()[0].status,'completed');
});
test('bad hash never produces an accepted final file',async t=>{
  const {manager,dir,url}=await fixture(t); const task=manager.start({id:'bad',title:'Bad',fileName:'bad.zip',downloadUrl:url+'/file',sha256:'0'.repeat(64)},dir);
  const result=await done(manager,task.id); assert.equal(result.status,'failed'); assert.match(result.error,/SHA-256/); assert.equal(fs.existsSync(result.destination),false);
});
test('host web pages and server failures are honest failures',async t=>{
  const {manager,dir,url}=await fixture(t); for(const endpoint of ['/html','/error']) {const task=manager.start({id:'bad',title:'Bad',fileName:'bad.zip',downloadUrl:url+endpoint},dir); assert.equal((await done(manager,task.id)).status,'failed');}
});
test('cancellation and retry transfer the complete file',async t=>{
  const {manager,dir,url}=await fixture(t); const task=manager.start({id:'slow',title:'Slow',fileName:'slow.zip',downloadUrl:url+'/slow'},dir);
  manager.cancel(task.id); assert.equal((await done(manager,task.id)).status,'cancelled'); manager.retry(task.id); const result=await done(manager,task.id); assert.equal(result.status,'completed'); assert.deepEqual(fs.readFileSync(result.destination),Buffer.concat([bytes,bytes]));
});
test('active task restored after shutdown becomes interrupted',async t=>{
  const {dir}=await fixture(t); const state=path.join(dir,'recovery.json'); fs.writeFileSync(state,JSON.stringify([{id:'x',destination:path.join(dir,'x.zip'),url:'https://example.com/x.zip',status:'downloading'}])); assert.equal(new DownloadManager(state).list()[0].status,'interrupted');
});
test('malformed history is preserved and does not block startup',async t=>{
  const {dir}=await fixture(t); const state=path.join(dir,'damaged.json'); fs.writeFileSync(state,'{bad'); assert.deepEqual(new DownloadManager(state).list(),[]); assert.ok(fs.readdirSync(dir).some(x=>x.startsWith('damaged.json.damaged-')));
});
test('parallel downloads never overwrite each other',async t=>{
  const {manager,dir,url}=await fixture(t); const a=manager.start({id:'a',title:'A',fileName:'same.zip',downloadUrl:url+'/file'},dir); const b=manager.start({id:'b',title:'B',fileName:'same.zip',downloadUrl:url+'/file'},dir);
  const results=await Promise.all([done(manager,a.id),done(manager,b.id)]); assert.notEqual(results[0].destination,results[1].destination); results.forEach(r=>assert.equal(r.status,'completed'));
});

test('downloads finish without hard-link support after hash verification', async t => {
  const {manager,dir,url}=await fixture(t);
  const link = t.mock.method(fs.promises, 'link', async () => { throw Object.assign(new Error('Hard links unsupported'), {code:'ENOTSUP'}); });
  const task=manager.start({id:'portable',title:'Portable',fileName:'file.bin',downloadUrl:url+'/file',sha256:digest},dir);
  const result=await done(manager,task.id);
  assert.equal(result.status,'completed');
  assert.deepEqual(fs.readFileSync(result.destination),bytes);
  assert.equal(result.actualSha256,digest);
  assert.equal(fs.existsSync(result.destination+'.part'),false);
  const bad=manager.start({id:'bad',title:'Bad',fileName:'file.bin',downloadUrl:url+'/file',sha256:'0'.repeat(64)},dir);
  assert.equal((await done(manager,bad.id)).status,'failed');
  assert.equal(link.mock.callCount(),1);
});

test('Windows exFAT hard-link EISDIR also completes a verified file', {skip:process.platform!=='win32'}, async t => {
  const {manager,dir,url}=await fixture(t);
  t.mock.method(fs.promises,'link',async()=>{throw Object.assign(new Error('Invalid function mapped to EISDIR'),{code:'EISDIR'});});
  const task=manager.start({id:'exfat',title:'exFAT',fileName:'file.bin',downloadUrl:url+'/file',sha256:digest},dir);
  const result=await done(manager,task.id);
  assert.equal(result.status,'completed');
  assert.deepEqual(fs.readFileSync(result.destination),bytes);
  assert.equal(result.actualSha256,digest);
});

test('portable completion never replaces a file created during finalization', async t => {
  const {manager,dir,url}=await fixture(t);
  t.mock.method(fs.promises, 'link', async (_src, dest) => {
    fs.writeFileSync(dest,'Existing user data');
    throw Object.assign(new Error('Hard links unsupported'), {code:'EPERM'});
  });
  const task=manager.start({id:'collision',title:'Collision',fileName:'file.bin',downloadUrl:url+'/file'},dir);
  const result=await done(manager,task.id);
  assert.equal(result.status,'failed');
  assert.match(result.error,/EEXIST/);
  assert.equal(fs.readFileSync(result.destination,'utf8'),'Existing user data');
  assert.deepEqual(fs.readFileSync(result.destination+'.part'),bytes);
});

test('cancelling portable completion removes only its incomplete final file', async t => {
  const {manager,dir,url}=await fixture(t);
  t.mock.method(fs.promises, 'link', async () => { throw Object.assign(new Error('Hard links unsupported'), {code:'ENOTSUP'}); });
  const originalWrite=fs.createWriteStream;
  let id, cancelCopy=true;
  t.mock.method(fs, 'createWriteStream', (file, options) => {
    const stream=originalWrite(file,options);
    if (!file.endsWith('.part')) stream.once('open',()=>{ if (cancelCopy) manager.cancel(id); });
    return stream;
  });
  const task=manager.start({id:'cancel-copy',title:'Cancel copy',fileName:'file.bin',downloadUrl:url+'/file'},dir);
  id=task.id;
  const result=await done(manager,id);
  assert.equal(result.status,'cancelled');
  assert.equal(fs.existsSync(result.destination),false);
  assert.deepEqual(fs.readFileSync(result.destination+'.part'),bytes);
  cancelCopy=false;
  manager.retry(id);
  assert.equal((await done(manager,id)).status,'completed');
});

test('failed portable writes retain the verified partial and remove their destination', async t => {
  const {manager,dir,url}=await fixture(t);
  t.mock.method(fs.promises, 'link', async () => { throw Object.assign(new Error('Hard links unsupported'), {code:'ENOTSUP'}); });
  const originalWrite=fs.createWriteStream;
  t.mock.method(fs, 'createWriteStream', (file, options) => {
    const stream=originalWrite(file,options);
    if (!file.endsWith('.part')) stream._write=(_chunk,_encoding,callback)=>callback(Object.assign(new Error('Disk full'),{code:'ENOSPC'}));
    return stream;
  });
  const task=manager.start({id:'full-disk',title:'Full disk',fileName:'file.bin',downloadUrl:url+'/file',sha256:digest},dir);
  const result=await done(manager,task.id);
  assert.equal(result.status,'failed');
  assert.match(result.error,/Disk full/);
  assert.equal(fs.existsSync(result.destination),false);
  assert.deepEqual(fs.readFileSync(result.destination+'.part'),bytes);
});
