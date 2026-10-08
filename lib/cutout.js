// Main-thread side of the runtime cutout: a tiny queue in front of up to two
// workers, plus a bounded cache so a bottle cut once stays cut while browsing.
const supported = typeof window !== 'undefined' && typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined' && typeof createImageBitmap !== 'undefined';
const LIMIT = typeof matchMedia !== 'undefined' && matchMedia('(max-width: 760px)').matches ? 60 : 160;
const cache = new Map(); // key -> Promise<result>
const pending = new Map(); // id -> resolve
const queue = [];
const workers = [];
let nextId = 0, busy = 0;
// ?cutout-debug in the URL exposes window.__cutouts for checking results.
const debug = typeof location !== 'undefined' && location.search.includes('cutout-debug') ? (window.__cutouts = []) : null;

function spawn() {
  const w = new Worker(new URL('./cutout.worker.js', import.meta.url), { type: 'module' });
  w.onmessage = e => { busy--; if (debug) debug.push({ src: e.data.src, ok: e.data.ok, reason: e.data.reason, w: e.data.w, h: e.data.h, url: e.data.url }); const done = pending.get(e.data.id); pending.delete(e.data.id); done?.(e.data); pump(); };
  w.onerror = () => { busy = Math.max(0, busy - 1); };
  return w;
}
function pump() {
  const size = Math.min(2, Math.max(1, (navigator.hardwareConcurrency || 2) - 1));
  while (busy < size && queue.length) {
    if (workers.length < size) workers.push(spawn());
    const job = queue.shift();
    busy++;
    workers[job.id % workers.length].postMessage(job);
  }
}

// Returns a promise of { ok, url, w, h } (ok:false when the photo is not a
// clean studio shot, the file is missing, or the browser cannot do it).
export function cutout(src, max = 900) {
  const key = src + '@' + max;
  if (cache.has(key)) { const p = cache.get(key); cache.delete(key); cache.set(key, p); return p; }
  const p = !supported ? Promise.resolve({ ok: false, reason: 'unsupported' }) : new Promise(resolve => {
    const id = nextId++;
    pending.set(id, resolve);
    queue.push({ id, src, max });
    pump();
  });
  cache.set(key, p);
  if (cache.size > LIMIT) cache.delete(cache.keys().next().value);
  return p;
}
// Synchronous peek so a bottle already cut renders instantly (no flash) on re-mount.
const settled = new Map();
export function cutoutNow(src, max = 900) { return settled.get(src + '@' + max) || null; }
export function cutoutTracked(src, max = 900) {
  return cutout(src, max).then(r => { settled.set(src + '@' + max, r); if (settled.size > LIMIT) settled.delete(settled.keys().next().value); return r; });
}
