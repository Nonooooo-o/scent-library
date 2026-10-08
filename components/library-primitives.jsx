import React, { useState } from 'react';
import imageClasses from '../data/image-classes.json';
import worldCutouts from '../data/world-cutouts.json';
import quarantined from '../data/world-cutouts-quarantined.json';
import tones from '../data/bottle-tones.json';

// ---------------------------------------------------------------------------
// One canonical image system for every surface.
//
//  photo     — product photo (card 600px / hero up to ~1200px). Shown inside an
//              ivory "vitrine" panel; the photo is multiplied onto the panel so
//              its white background becomes the lit niche.
//  specimen  — the ~330 records that only have a tiny source (often 135px tall).
//              Never enlarged: the image keeps its native pixel size on a small
//              ivory plate inside a colour field derived from the bottle.
//  type      — missing / unusable image (D class, 404, decode error): a purely
//              typographic plate. Never a broken-image icon.
//  cutout    — transparent /thumbnails/{id}_world.webp, used where bottles
//              float in the dark (entrance, detail stage). Falls back to photo.
// ---------------------------------------------------------------------------
const QUARANTINED = new Set(quarantined.ids);
export const imageClassFor = p => imageClasses[p?.id] || (p?.imageHero ? 'B' : 'C');
export const toneFor = p => tones[p?.id] || '96,84,64';
export const hasPhoto = p => !!p?.imageHero && imageClassFor(p) !== 'D';
export const isTiny = p => !p?.imageHero && imageClassFor(p) !== 'D';
export const hasCutout = p => !!(p && worldCutouts[p.id] && !QUARANTINED.has(p.id) && imageClassFor(p) !== 'D');
export const cutoutSrc = p => `/thumbnails/${p.id}_world.webp`;
export const objectNo = p => String(p.sourceOrder).padStart(4, '0');

const photoSrcSet = p => p.imageHero ? `${p.image} 600w, ${p.imageHero} 1200w` : undefined;
const vtName = (p, focusId, enabled) => enabled && focusId === p.id ? { viewTransitionName: 'selected-bottle' } : undefined;

function initialOf(p) {
  const en = (p.nameEnglish || '').replace(/^[^A-Za-z]+/, '');
  return (en.charAt(0) || p.brand.charAt(0) || '·').toUpperCase();
}

export function TypePlate({ perfume: p, large = false }) {
  return <span className={`type-plate ${large ? 'is-large' : ''}`} aria-hidden="true">
    <span className="type-initial">{initialOf(p)}</span>
    <span className="type-name">{p.nameChinese}</span>
    <span className="type-no">No. {objectNo(p)}</span>
  </span>;
}

// Small card / thumbnail / large detail vitrine. `size`: 'card' | 'thumb' | 'stage'
export function Vitrine({ perfume: p, size = 'card', eager = false, sizes, focusId = null, shared = false }) {
  const [failed, setFailed] = useState(false);
  const kind = failed ? 'type' : hasPhoto(p) ? 'photo' : isTiny(p) ? 'specimen' : 'type';
  const alt = `${p.brand} ${p.nameChinese}`;
  const tone = { '--tone': toneFor(p) };
  if (kind === 'photo') {
    const stage = size === 'stage';
    return <span className={`vitrine vitrine-${size} is-photo`} style={tone}>
      <img className="vitrine-img bottle-image" data-perfume-id={p.id} src={stage ? p.imageHero : p.image}
        srcSet={stage ? undefined : photoSrcSet(p)} sizes={stage ? undefined : (sizes || '(max-width: 700px) 46vw, (max-width: 1200px) 30vw, 300px')}
        width={stage ? undefined : p.imageWidth} height={stage ? undefined : p.imageHeight}
        alt={alt} loading={eager ? 'eager' : 'lazy'} decoding="async" style={vtName(p, focusId, shared)} onError={() => setFailed(true)} />
    </span>;
  }
  if (kind === 'specimen') {
    return <span className={`vitrine vitrine-${size} is-specimen`} style={tone}>
      <span className="specimen-no" aria-hidden="true">{objectNo(p)}</span>
      <span className="specimen-plate">
        <img className="specimen-img bottle-image" data-perfume-id={p.id} src={p.image} width={p.imageWidth} height={p.imageHeight}
          alt={alt} loading={eager ? 'eager' : 'lazy'} decoding="async" style={vtName(p, focusId, shared)} onError={() => setFailed(true)} />
      </span>
      {size === 'stage' && <span className="specimen-note" aria-hidden="true">原始小图 · 不放大</span>}
    </span>;
  }
  return <span className={`vitrine vitrine-${size} is-type`} style={tone} role="img" aria-label={alt}>
    <TypePlate perfume={p} large={size === 'stage'} />
  </span>;
}

// A bottle that floats in the dark: transparent cutout, else the vitrine.
export function FloatingBottle({ perfume: p, eager = false, focusId = null, shared = false, className = '' }) {
  const [failed, setFailed] = useState(false);
  if (!hasCutout(p) || failed) return <span className={`floating-fallback ${className}`}><Vitrine perfume={p} size="float" eager={eager} focusId={focusId} shared={shared} /></span>;
  return <img className={`cutout bottle-image ${className}`} data-perfume-id={p.id} src={cutoutSrc(p)} alt={`${p.brand} ${p.nameChinese}`}
    loading={eager ? 'eager' : 'lazy'} decoding="async" draggable="false" style={vtName(p, focusId, shared)} onError={() => setFailed(true)} />;
}

export function Rating({ value, label = true }) {
  return <span className="rating" aria-label={`我的评分 ${value} / 5`}>
    <span className="rating-dots" aria-hidden="true">{[1, 2, 3, 4, 5].map(n => <i key={n} className={n <= value ? 'on' : ''} />)}</span>
    {label && <span className="rating-num" aria-hidden="true">{value}<small>/5</small></span>}
  </span>;
}
