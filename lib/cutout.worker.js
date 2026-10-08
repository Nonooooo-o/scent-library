// Turns a product photo into a transparent bottle, off the main thread.
// Same-origin fetch only (CSP: default-src 'self').
//
// Studio photos come in three kinds, each handled differently:
//  • light backdrop, bottle clear of it  → flood-fill the backdrop inwards from
//    the border (labels/highlights inside the bottle stay), soft 1px edge
//  • light backdrop the flood cannot separate (white glass on white, bottle
//    cropped by the frame) → soft colour key: alpha grows with distance from
//    the backdrop colour, so pale glass turns translucent instead of vanishing
//  • black backdrop → the same soft key against black
// Everything else (scenes, props, coloured sets) is reported as not cuttable and
// the page shows the photo melting into the dark instead.
// Semi-transparent edge pixels are un-mixed from the backdrop so no white or
// grey fringe remains. The result is a webp/png data: URL (CSP: img-src data:).

const dist = (d, i, r, g, b) => Math.max(Math.abs(d[i] - r), Math.abs(d[i + 1] - g), Math.abs(d[i + 2] - b));
const median = arr => arr.sort((a, b) => a - b)[arr.length >> 1];

function borderSamples(w, h) {
  const out = [], step = Math.max(1, Math.floor((w + h) / 500));
  for (let x = 0; x < w; x += step) out.push(x * 4, ((h - 1) * w + x) * 4);
  for (let y = 0; y < h; y += step) out.push(y * w * 4, (y * w + w - 1) * 4);
  return out;
}
function backdrop(d, w, h) {
  const s = borderSamples(w, h);
  const lum = i => (d[i] + d[i + 1] + d[i + 2]) / 3;
  const sat = i => Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]);
  const light = s.filter(i => lum(i) > 196 && sat(i) < 28);
  const dark = s.filter(i => lum(i) < 34);
  const pick = list => ({ r: median(list.map(i => d[i])), g: median(list.map(i => d[i + 1])), b: median(list.map(i => d[i + 2])) });
  if (light.length / s.length >= .22) {
    const c = pick(light);
    return { kind: 'light', ...c, uniform: s.filter(i => dist(d, i, c.r, c.g, c.b) <= 26).length / s.length };
  }
  if (dark.length / s.length >= .6) return { kind: 'dark', ...pick(dark), uniform: 1 };
  return { kind: 'scene' };
}

// shared tail: un-mix the backdrop from partial pixels, measure, sanity-check
function finish(d, alpha, w, h, bg, unmix = true) {
  const n = w * h;
  let minX = w, minY = h, maxX = -1, maxY = -1, solid = 0, semi = 0;
  for (let p = 0; p < n; p++) {
    const a = alpha[p], i = p * 4;
    if (a > 30 && a < 200) semi++;
    if (unmix && a > 0 && a < 255) {
      const k = a / 255;
      d[i] = Math.max(0, Math.min(255, (d[i] - (1 - k) * bg.r) / k));
      d[i + 1] = Math.max(0, Math.min(255, (d[i + 1] - (1 - k) * bg.g) / k));
      d[i + 2] = Math.max(0, Math.min(255, (d[i + 2] - (1 - k) * bg.b) / k));
    }
    d[i + 3] = a;
    if (a > 40) { solid++; const x = p % w, y = (p / w) | 0; if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  }
  const share = solid / n;
  // a scene, not an object: opaque along three or four sides of the frame
  const side = (len, at) => { let o = 0; for (let k = 0; k < len; k++) o += alpha[at(k)] > 128; return o / len; };
  const sides = [side(w, k => k), side(w, k => (h - 1) * w + k), side(h, k => k * w), side(h, k => k * w + w - 1)].filter(f => f > .5).length;
  if (sides >= 3 && Math.max(w, h) >= 240) return { ok: false, reason: `scene-edges ${sides}` };
  if (maxX < 0 || share < .03 || share > (Math.max(w, h) < 240 ? .985 : .93)) return { ok: false, reason: `coverage ${share.toFixed(2)}` };
  const fill = solid / ((maxX - minX + 1) * (maxY - minY + 1));
  return { ok: true, fill, semi: semi / Math.max(1, solid), box: [Math.max(0, minX - 2), Math.max(0, minY - 2), Math.min(w - 1, maxX + 2), Math.min(h - 1, maxY + 2)] };
}

// separable square min/max filter on a 0/1 mask
function morph(src, w, h, r, grow) {
  const tmp = new Uint8Array(w * h), out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let v = grow ? 0 : 1;
    for (let k = -r; k <= r; k++) { const xx = x + k; const s = xx < 0 || xx >= w ? (grow ? 0 : 1) : src[y * w + xx]; v = grow ? (v | s) : (v & s); }
    tmp[y * w + x] = v;
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let v = grow ? 0 : 1;
    for (let k = -r; k <= r; k++) { const yy = y + k; const s = yy < 0 || yy >= h ? (grow ? 0 : 1) : tmp[yy * w + x]; v = grow ? (v | s) : (v & s); }
    out[y * w + x] = v;
  }
  return out;
}
// The backdrop can leak into a white label through a thin bright glass edge.
// Keep only backdrop reachable from the border through passages wider than
// 2r+1 px, then grow it back to the original outline.
function blockLeaks(mask, w, h, r) {
  const n = w * h, core = morph(mask, w, h, r, false), reach = new Uint8Array(n), stack = new Int32Array(n);
  let sp = 0;
  const seed = p => { if (core[p] && !reach[p]) { reach[p] = 1; stack[sp++] = p; } };
  for (let x = 0; x < w; x++) { seed(x); seed((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { seed(y * w); seed(y * w + w - 1); }
  while (sp) { const p = stack[--sp], x = p % w; if (x > 0) seed(p - 1); if (x < w - 1) seed(p + 1); if (p >= w) seed(p - w); if (p < n - w) seed(p + w); }
  const back = morph(reach, w, h, r + 1, true);
  for (let p = 0; p < n; p++) mask[p] = mask[p] && back[p] ? 1 : 0;
}

function flood(d, w, h, bg) {
  const n = w * h, T = 30, small = Math.max(w, h) < 240;
  const mask = new Uint8Array(n), stack = new Int32Array(n);
  let sp = 0;
  const seed = p => { if (!mask[p] && dist(d, p * 4, bg.r, bg.g, bg.b) <= T) { mask[p] = 1; stack[sp++] = p; } };
  for (let x = 0; x < w; x++) { seed(x); seed((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { seed(y * w); seed(y * w + w - 1); }
  while (sp) {
    const p = stack[--sp], x = p % w;
    if (x > 0) seed(p - 1);
    if (x < w - 1) seed(p + 1);
    if (p >= w) seed(p - w);
    if (p < n - w) seed(p + w);
  }
  if (!small) blockLeaks(mask, w, h, Math.max(2, Math.round(Math.max(w, h) / 260)));
  const solid = new Uint8Array(n);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = y * w + x;
    if (mask[p]) continue;
    // erode 1px on normal photos; tiny originals keep every pixel they have
    solid[p] = small || ((x === 0 || !mask[p - 1]) && (x === w - 1 || !mask[p + 1]) && (y === 0 || !mask[p - w]) && (y === h - 1 || !mask[p + w])) ? 255 : 0;
  }
  const alpha = new Uint8Array(n);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let s = 0, c = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const yy = y + dy, xx = x + dx;
      if (yy < 0 || yy >= h || xx < 0 || xx >= w) continue;
      s += solid[yy * w + xx]; c++;
    }
    const p = y * w + x;
    alpha[p] = small ? (solid[p] ? Math.max(170, s / c) : s / c * .6) : s / c;
  }
  return alpha;
}

function softKey(d, w, h, bg, lo, hi) {
  const n = w * h, alpha = new Uint8Array(n);
  for (let p = 0; p < n; p++) {
    const t = (dist(d, p * 4, bg.r, bg.g, bg.b) - lo) / (hi - lo);
    alpha[p] = t <= 0 ? 0 : t >= 1 ? 255 : Math.round(t * t * (3 - 2 * t) * 255);
  }
  const out = new Uint8Array(n);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let s = 0, c = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const yy = y + dy, xx = x + dx;
      if (yy < 0 || yy >= h || xx < 0 || xx >= w) continue;
      s += alpha[yy * w + xx]; c++;
    }
    out[y * w + x] = Math.round(s / c);
  }
  return out;
}

function cut(img, w, h) {
  const d = img.data;
  const bg = backdrop(d, w, h);
  if (bg.kind === 'scene') return { ok: false, reason: 'scene' };
  if (bg.kind === 'light' && bg.uniform >= .3) {
    const copy = new Uint8ClampedArray(d);
    const r = finish(d, flood(d, w, h, bg), w, h, bg);
    if (r.ok && r.fill >= .3) return { ...r, mode: 'flood' };
    d.set(copy); // flood ate into the bottle: fall back to the soft key
  }
  const r = bg.kind === 'dark' ? finish(d, softKey(d, w, h, bg, 10, 46), w, h, bg) : finish(d, softKey(d, w, h, bg, 12, 52), w, h, bg, false);
  if (!r.ok) return r;
  // pale glass on a pale backdrop keys out to a see-through ghost that reads as
  // a dark bottle: misleading, so let the page show the photo itself instead
  if (bg.kind === 'light' && (r.fill < .5 || r.semi > .3)) return { ok: false, reason: `pale ${r.fill.toFixed(2)}/${r.semi.toFixed(2)}` };
  return { ...r, mode: bg.kind === 'dark' ? 'dark-key' : 'key' };
}

async function run({ id, src, max }) {
  const res = await fetch(src);
  if (!res.ok) return { id, src, ok: false, missing: true };
  const bmp = await createImageBitmap(await res.blob());
  const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * s)), h = Math.max(1, Math.round(bmp.height * s));
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close?.();
  const img = ctx.getImageData(0, 0, w, h);
  const result = cut(img, w, h);
  if (!result.ok) return { id, src, ok: false, reason: result.reason };
  const [x0, y0, x1, y1] = result.box, cw = x1 - x0 + 1, chh = y1 - y0 + 1;
  ctx.putImageData(img, 0, 0);
  const out = new OffscreenCanvas(cw, chh);
  out.getContext('2d').drawImage(canvas, x0, y0, cw, chh, 0, 0, cw, chh);
  const blob = await out.convertToBlob({ type: 'image/webp', quality: .92 });
  const url = new FileReaderSync().readAsDataURL(blob);
  return { id, src, ok: true, url, w: cw, h: chh, reason: result.mode };
}

self.onmessage = async e => {
  try { self.postMessage(await run(e.data)); }
  catch (err) { self.postMessage({ id: e.data.id, src: e.data.src, ok: false, reason: 'error' }); }
};
