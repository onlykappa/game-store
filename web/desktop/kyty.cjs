const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { readJson, writeJson } = require('./core.cjs');
function validateExecutable(file) {
  if (typeof file !== 'string' || !path.isAbsolute(file) || path.basename(file).toLowerCase() !== 'kyty_emulator.exe' || !fs.statSync(file).isFile()) throw new Error('Choose kyty_emulator.exe from a complete KytyPS5 installation, not launcher.exe.');
  return file;
}
function validateTarget(target) {
  if (typeof target !== 'string' || !path.isAbsolute(target)) throw new Error('Select an extracted game folder or a .zar file.');
  const stat = fs.statSync(target);
  if (stat.isDirectory()) {
    const boot = path.join(target, 'eboot.bin');
    if (!fs.existsSync(boot) || !fs.statSync(boot).isFile() || !fs.statSync(boot).size) throw new Error('Select the game root folder containing eboot.bin. Extract ZIP/RAR archives first.');
    const param = path.join(target, 'sce_sys', 'param.json');
    if (fs.existsSync(param) && fs.statSync(param).size < 1024 * 1024) {
      let meta; try { meta = JSON.parse(fs.readFileSync(param, 'utf8')); } catch { /* Emulator validates malformed metadata. */ }
      if (typeof meta?.titleId === 'string' && /^CUSA/i.test(meta.titleId)) throw new Error('This is a PS4 game. KytyPS5 integration is for PS5 games.');
    }
    return target;
  }
  if (stat.isFile() && stat.size > 0 && path.extname(target).toLowerCase() === '.zar') return target;
  throw new Error('KytyPS5 expects a game folder containing eboot.bin or a .zar dump. ZIP, RAR, PKG and exFAT images are not launch targets here.');
}
function localCatalogEntry(target) {
  validateTarget(target);
  let title = path.basename(target).replace(/\.zar$/i, '');
  const param = path.join(target, 'sce_sys', 'param.json');
  if (fs.existsSync(param) && fs.statSync(param).size < 1024 * 1024) {
    try { const meta = JSON.parse(fs.readFileSync(param, 'utf8')); title = meta.localizedParameters?.['en-US']?.titleName || meta.titleName || title; } catch { /* Folder name is the fallback. */ }
  }
  return { id: 'local-' + crypto.createHash('sha256').update(path.resolve(target)).digest('hex').slice(0,24), title: String(title).slice(0,300), platform: 'ps5', shortDescription: 'Local PS5 game linked to KytyPS5. Compatibility has not been verified.', genres: [], features: [], images: {} };
}
class KytyLauncher {
  constructor(file, { spawnImpl = spawn, platform = process.platform, onChange = () => {} } = {}) {
    this.file = file; this.spawnImpl = spawnImpl; this.platform = platform; this.onChange = onChange; this.active = new Set();
    const saved = readJson(file, {});
    this.state = { executable: typeof saved?.executable === 'string' ? saved.executable : '', linked: saved?.linked && typeof saved.linked === 'object' && !Array.isArray(saved.linked) ? saved.linked : {}, lastLaunch: saved?.lastLaunch || null };
    if (this.state.lastLaunch?.status === 'running') this.state.lastLaunch.status = 'unknown';
  }
  snapshot() { return { ...this.state, linked: { ...this.state.linked } }; }
  save() { writeJson(this.file, this.state); this.onChange(this.snapshot()); }
  configure(executable) { this.state.executable = validateExecutable(executable); this.save(); return this.snapshot(); }
  link(game, target) {
    if (String(game.platform).toLowerCase() === 'ps4' || /^CUSA/i.test(game.id)) throw new Error('Use a PS4 emulator for this game.');
    validateTarget(target); this.state.linked[game.id] = target; this.save(); return this.snapshot();
  }
  async launch(game) {
    if (this.platform !== 'win32') throw new Error('This integration launches the Windows KytyPS5 executable.');
    if (this.active.has(game.id)) throw new Error('This game already has a running KytyPS5 process.');
    const exe = validateExecutable(this.state.executable);
    const target = validateTarget(this.state.linked[game.id]);
    if (String(game.platform).toLowerCase() === 'ps4' || /^CUSA/i.test(game.id)) throw new Error('Use a PS4 emulator for this game.');
    this.active.add(game.id);
    const record = { gameId: game.id, title: game.title, status: 'starting', startedAt: new Date().toISOString(), log: '', exitCode: null };
    this.state.lastLaunch = record; this.save();
    try {
      await new Promise((resolve, reject) => {
        const child = this.spawnImpl(exe, ['--game', target], { cwd: path.dirname(exe), shell: false, windowsHide: false, stdio: ['ignore', 'pipe', 'pipe'] });
        const append = chunk => { record.log = (record.log + String(chunk)).slice(-16000); };
        child.stdout?.on('data', append); child.stderr?.on('data', append);
        child.once('spawn', () => { record.status = 'running'; record.pid = child.pid; this.save(); resolve(); });
        child.once('error', err => { this.active.delete(game.id); record.status = 'failed'; record.error = err.message; this.save(); reject(err); });
        child.once('close', (code, signal) => { this.active.delete(game.id); if (record.status !== 'failed') record.status = code === 0 ? 'exited' : 'failed'; record.exitCode = code; record.signal = signal; record.finishedAt = new Date().toISOString(); this.save(); });
      });
      return this.snapshot();
    } catch (err) { this.active.delete(game.id); throw err; }
  }
}
module.exports = { validateExecutable, validateTarget, localCatalogEntry, KytyLauncher };
