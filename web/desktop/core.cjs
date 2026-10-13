const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { pipeline } = require('node:stream/promises');
const { Readable, Transform } = require('node:stream');

function webUrl(value, allowHttp = false) {
  const u = new URL(value);
  if (!(u.protocol === 'https:' || (allowHttp && u.protocol === 'http:')) || u.username || u.password) throw new Error('Use a direct HTTPS URL without embedded credentials.');
  return u.href;
}
const text = (v, fallback = '') => typeof v === 'string' ? v.slice(0, 10000) : fallback;
const strings = v => Array.isArray(v) ? v.filter(x => typeof x === 'string').slice(0, 100) : [];
const art = v => { try { return v ? webUrl(v) : ''; } catch { return ''; } };
function normalizeCatalog(input) {
  const rows = Array.isArray(input) ? input : input?.games;
  if (!Array.isArray(rows) || rows.length > 50000) throw new Error('Catalog must be an array or { games: [...] }, up to 50,000 games.');
  const ids = new Set();
  return rows.map((g, i) => {
    if (!g || typeof g !== 'object' || typeof g.title !== 'string' || !g.title.trim()) throw new Error(`Game ${i + 1} needs a title.`);
    const id = text(g.id, `game-${i + 1}`);
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id) || ids.has(id)) throw new Error(`Game ${i + 1} has an invalid or duplicate ID.`);
    ids.add(id);
    const fileName = text(g.fileName, `${id}.zip`);
    if (fileName.length > 180 || /[<>:"/\\|?*\x00-\x1f]/.test(fileName) || /[. ]$/.test(fileName) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(fileName) || fileName === '.' || fileName === '..') throw new Error(`Invalid filename for ${g.title}.`);
    if (g.sha256 && !/^[a-f0-9]{64}$/i.test(g.sha256)) throw new Error(`Invalid SHA-256 for ${g.title}.`);
    const images = g.images || {};
    return { id, slug: id, title: text(g.title).trim(), shortDescription: text(g.shortDescription), about: text(g.about), developer: text(g.developer), publisher: text(g.publisher), releaseDate: /^\d{4}-\d{2}-\d{2}$/.test(g.releaseDate) ? g.releaseDate : '', genres: strings(g.genres), features: strings(g.features), metacritic: Number.isFinite(g.metacritic) ? Math.max(0, Math.min(100, g.metacritic)) : null, recommendations: Number.isFinite(g.recommendations) ? Math.max(0, g.recommendations) : 0, ageRating: Number.isFinite(g.ageRating) ? g.ageRating : null, sizeGb: Number.isFinite(g.sizeGb) && g.sizeGb >= 0 ? g.sizeGb : null, images: { cover: art(images.cover), hero: art(images.hero), logo: art(images.logo), header: art(images.header) }, screenshots: strings(g.screenshots).map(art).filter(Boolean), platform: text(g.platform, 'Unspecified'), fileName, ...(g.downloadUrl ? { downloadUrl: webUrl(g.downloadUrl) } : {}), ...(g.sha256 ? { sha256: g.sha256.toLowerCase() } : {}) };
  });
}
function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file + '.tmp', JSON.stringify(data, null, 2));
  fs.renameSync(file + '.tmp', file);
}
function readJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { fs.copyFileSync(file, file + `.damaged-${Date.now()}`); return fallback; }
}
class DownloadManager {
  constructor(stateFile, onChange = () => {}, { allowHttp = false } = {}) {
    this.stateFile = stateFile; this.onChange = onChange; this.allowHttp = allowHttp; this.active = new Map();
    const saved = readJson(stateFile, []);
    this.tasks = Array.isArray(saved) ? saved.filter(t => t && typeof t.id === 'string' && typeof t.destination === 'string' && typeof t.url === 'string').map(t => ({ ...t, status: t.status === 'downloading' ? 'interrupted' : t.status })) : [];
    this.save();
  }
  save() { writeJson(this.stateFile, this.tasks); this.onChange(this.list()); }
  list() { return this.tasks.map(t => ({ ...t })); }
  start(game, folder) {
    if (!game.downloadUrl) throw new Error('This game has no direct download source.');
    if (this.tasks.some(t => t.gameId === game.id && t.status === 'downloading')) throw new Error('This game is already downloading.');
    const url = webUrl(game.downloadUrl, this.allowHttp);
    const id = crypto.randomUUID();
    // Each task owns a unique folder. Never overwrite an existing user file.
    const destination = path.join(folder, `${game.id}-${id.slice(0,8)}`, game.fileName);
    const task = { id, gameId: game.id, title: game.title, url, destination, sha256: game.sha256 || '', status: 'downloading', received: 0, total: null, error: '', createdAt: new Date().toISOString() };
    this.tasks.push(task); this.run(task); return { ...task };
  }
  retry(id) {
    const task = this.tasks.find(t => t.id === id);
    if (!task || !['failed', 'cancelled', 'interrupted'].includes(task.status)) throw new Error('This download cannot be retried.');
    if (this.active.has(id)) throw new Error('Wait for cancellation to finish.');
    task.status = 'downloading'; task.received = 0; task.total = null; task.error = ''; this.run(task); return { ...task };
  }
  cancel(id) { const entry = this.active.get(id); if (!entry) throw new Error('Download is not active.'); entry.cancelled = true; entry.controller.abort(); }
  async run(task) {
    const entry = { controller: new AbortController(), cancelled: false }; this.active.set(task.id, entry); this.save();
    const partial = task.destination + '.part';
    try {
      if (fs.existsSync(task.destination)) throw new Error('Destination already exists. Choose a new download rather than overwriting it.');
      fs.mkdirSync(path.dirname(task.destination), { recursive: true });
      let current = webUrl(task.url, this.allowHttp), response;
      for (let redirects = 0; redirects <= 8; redirects++) {
        response = await fetch(current, { redirect: 'manual', signal: entry.controller.signal, headers: { 'Accept-Encoding': 'identity' } });
        if ([301,302,303,307,308].includes(response.status)) {
          const next = response.headers.get('location'); await response.body?.cancel();
          if (!next || redirects === 8) throw new Error('Too many redirects or missing redirect destination.');
          current = webUrl(new URL(next, current).href, this.allowHttp); continue;
        }
        break;
      }
      if (!response.ok || response.status !== 200 || !response.body) { await response.body?.cancel(); throw new Error(`Download server returned HTTP ${response.status}.`); }
      const kind = response.headers.get('content-type') || '';
      if (/text\/html|application\/json/i.test(kind)) { await response.body.cancel(); throw new Error('This source returns a web page, not a file. Import a direct download URL.'); }
      const length = Number(response.headers.get('content-length'));
      task.total = length > 0 ? length : null;
      const hash = crypto.createHash('sha256'); let last = 0;
      const meter = new Transform({ transform: (chunk, _enc, cb) => {
        task.received += chunk.length; hash.update(chunk);
        if (Date.now() - last > 250) { last = Date.now(); this.onChange(this.list()); }
        cb(null, chunk);
      } });
      await pipeline(Readable.fromWeb(response.body), meter, fs.createWriteStream(partial, { flags: 'w' }), { signal: entry.controller.signal });
      if (task.total !== null && task.received !== task.total) throw new Error('File was truncated. Retry the download.');
      const digest = hash.digest('hex');
      if (task.sha256 && digest !== task.sha256) throw new Error('SHA-256 does not match. The file was not accepted.');
      // Prefer the zero-copy operation, but exFAT/FAT cannot create hard links.
      // Both paths create the destination exclusively, after verification.
      try {
        await fs.promises.link(partial, task.destination);
      } catch (err) {
        // libuv maps Windows ERROR_INVALID_FUNCTION (exFAT) to EISDIR.
        const unsupported = ['ENOTSUP', 'EOPNOTSUPP', 'ENOSYS', 'EPERM'].includes(err.code)
          || (process.platform === 'win32' && err.code === 'EISDIR');
        if (!unsupported) throw err;
        const output = fs.createWriteStream(task.destination, { flags: 'wx' });
        let created = false;
        output.once('open', () => { created = true; });
        try {
          await pipeline(fs.createReadStream(partial), output, { signal: entry.controller.signal });
        } catch (copyError) {
          // A collision never opened our file: preserve the existing destination.
          if (created) await fs.promises.unlink(task.destination);
          throw copyError;
        }
      }
      await fs.promises.unlink(partial);
      task.status = 'completed'; task.actualSha256 = digest; task.finishedAt = new Date().toISOString();
    } catch (err) {
      task.status = entry.cancelled ? 'cancelled' : 'failed'; task.error = entry.cancelled ? 'Cancelled. Retry starts from the beginning.' : err.message;
    } finally {
      this.active.delete(task.id); this.save();
    }
  }
}
module.exports = { normalizeCatalog, DownloadManager, readJson, writeJson, webUrl };
