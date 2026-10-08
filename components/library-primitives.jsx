import React, { useEffect, useRef, useState } from 'react';
import imageClasses from '../data/image-classes.json';
import worldCutouts from '../data/world-cutouts.json';
import quarantined from '../data/world-cutouts-quarantined.json';
import tones from '../data/bottle-tones.json';
import { cutoutTracked, cutoutNow } from '../lib/cutout.js';

// ---------------------------------------------------------------------------
// One image system for every surface: a bottle standing in the dark.
//
//  1. world    — /thumbnails/{id}_world.webp, the prepared transparent cutout.
//  2. runtime  — no cutout file (or it failed to load): the product photo's
//                light studio backdrop is removed in a worker (lib/cutout.*).
//                Tiny originals are cut at their native size, never enlarged.
//  3. photo    — the photo is not a clean studio shot (scene, props, white
//                bottle on white): the original photograph, unprocessed.
//  4. type     — no usable image at all (D class / missing): a typographic plate.
// ---------------------------------------------------------------------------
const QUARANTINED = new Set(quarantined.ids);
export const imageClassFor = p => imageClasses[p?.id] || (p?.imageHero ? 'B' : 'C');
export const toneFor = p => tones[p?.id] || '96,84,64';
export const hasPhoto = p => !!p?.imageHero && imageClassFor(p) !== 'D';
export const isTiny = p => !p?.imageHero && imageClassFor(p) !== 'D';
export const hasCutout = p => !!(p && worldCutouts[p.id] && !QUARANTINED.has(p.id) && imageClassFor(p) !== 'D');
export const cutoutSrc = p => `/thumbnails/${p.id}_world.webp`;
export const objectNo = p => String(p.sourceOrder).padStart(4, '0');

export function TypePlate({ perfume: p, large = false }) {
  return <span className={`type-plate ${large ? 'is-large' : ''}`} aria-hidden="true">
    <span className="type-name">{p.nameChinese}</span>
    <span className="type-no">暂无图片</span>
  </span>;
}

// Which photo to cut, and at what working size, for each display size.
function runtimeSource(p, size) {
  if (isTiny(p)) return { src: p.image, max: 4000, native: true };
  if (!hasPhoto(p)) return null;
  if (size === 'stage') return { src: p.imageHero, max: 1100 };
  if (size === 'float') return { src: p.imageHero, max: 800 };
  if (size === 'thumb') return { src: p.image, max: 360 };
  return { src: p.image, max: 640 };
}

// Start work only when the bottle is near the viewport (eager ones at once).
function useNearViewport(ref, eager) {
  const [near, setNear] = useState(eager);
  useEffect(() => {
    if (near || !ref.current) return;
    if (typeof IntersectionObserver === 'undefined') { setNear(true); return; }
    const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { setNear(true); io.disconnect(); } }, { rootMargin: '480px 240px' });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [near]);
  return near;
}

export function Bottle({ perfume: p, size = 'card', eager = false, focusId = null, shared = false, className = '' }) {
  const ref = useRef(null);
  const run = runtimeSource(p, size);
  const [worldFailed, setWorldFailed] = useState(false);
  const useWorld = hasCutout(p) && !worldFailed;
  const [result, setResult] = useState(() => (!hasCutout(p) && run && cutoutNow(run.src, run.max)) || null);
  const [loaded, setLoaded] = useState(false);
  const [broken, setBroken] = useState(false);
  const near = useNearViewport(ref, eager);
  useEffect(() => {
    if (useWorld || !run || result || !near) return;
    let live = true;
    cutoutTracked(run.src, run.max).then(r => { if (live) setResult(r); });
    return () => { live = false; };
  }, [useWorld, near, run?.src]);
  const alt = `${p.brand} ${p.nameChinese}`;
  const vt = shared && focusId === p.id ? { viewTransitionName: 'selected-bottle' } : undefined;
  const common = { 'data-perfume-id': p.id, alt, decoding: 'async', draggable: false, onLoad: () => setLoaded(true) };
  let body;
  if ((!run && !useWorld) || broken || result?.missing) {
    body = <TypePlate perfume={p} large={size === 'stage'} />;
  } else if (useWorld) {
    body = <img className="bottle-img bottle-image" src={cutoutSrc(p)} loading={eager ? 'eager' : 'lazy'} {...common} style={vt} onError={() => setWorldFailed(true)} />;
  } else if (!result) {
    body = null;
  } else if (result.ok) {
    const native = run.native ? { maxWidth: result.w + 'px', maxHeight: result.h + 'px' } : null;
    body = <img className={`bottle-img bottle-image ${run.native ? 'is-native' : ''}`} src={result.url} width={result.w} height={result.h} {...common} style={{ ...native, ...vt }} />;
  } else {
    // not a clean studio shot (scene, prop, white-on-white): the original photo as it is
    const native = run.native ? { maxWidth: p.imageWidth + 'px', maxHeight: p.imageHeight + 'px' } : null;
    body = <img className={`bottle-img bottle-photo bottle-image ${run.native ? 'is-native' : ''}`} src={run.src} width={p.imageWidth} height={p.imageHeight} {...common} style={{ ...native, ...vt }} onError={() => setBroken(true)} />;
  }
  const typed = body?.type === TypePlate;
  return <span ref={ref} className={`bottle-frame size-${size} ${loaded || typed ? 'is-loaded' : ''} ${typed ? 'is-type' : ''} ${className}`}>
    {body}
  </span>;
}

// Kept names used across the pages.
export const Vitrine = props => <Bottle {...props} />;
export const FloatingBottle = props => <Bottle size="float" {...props} />;

export function Rating({ value }) {
  return <span className="rating" aria-label={`我的评分 ${value} / 5`}>{value}<span className="rating-of">/5</span></span>;
}
