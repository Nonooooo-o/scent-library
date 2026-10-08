# Phase 6 — Art direction: private scent museum-library (audit)

Date: 2026-09-19. Status: FINAL.

## Brief (user's words, condensed)
The site should feel like walking into a personal collection: part library,
part museum, part private archive, part secret collection room. Perfumes are
not products — they are collected objects, holdings, museum pieces,
catalogued memories. Dark, quiet, refined; subtle light; archival calm;
cinematic depth; negative space; careful typography; slow elegant motion.
No ecommerce, no product cards, no floating white rectangles, no PPT collage.

## Per-room treatment

### Entrance hall (Homepage / Explore)
- Bottles render as museum mounts: layered alpha-following drop-shadows
  (ambient floor shadow + faint top rim-light that lifts glass edges) and a
  soft "pedestal shadow-pool" ellipse under foreground/midground pieces, so
  each bottle hovers above an unseen shelf.
- Atmosphere: faint side aisles of light (receding colonnades) added to the
  existing ink-wash / light-fold / grain ground. Monument 1600+ untouched.

### Brands — branded cases
- Faint vertical case mullions (cabinet divisions) in the atmosphere at 3%
  opacity — shelves/cases without rectangles around bottles.
- Room title gets an archival hairline rule (plaque underline).

### Timeline — chronological gallery corridor
- NEW: a quiet decade rail on the right wall (hairline spine + ticks);
  the current decade tick is lit, the rest recede. Non-interactive,
  aria-hidden (scroll/controls remain the interaction).
- Corridor projection geometry unchanged.

### 5★ — private rare-collection room
- The favourite's name block is now an illuminated archival plaque:
  hairline frame, lit top rule, letterspaced small caps, serif name,
  "私藏五星 · N / 126" accession line (dynamic count).
- Quarantined p0420 (hand prop) is excluded via `FIVE_OK`; companions,
  cycling, and the accession line all use the filtered list.
- Existing chamber-light spotlight + hushed companions kept.

### Object Chamber — single-object exhibition room
- Vitrine treatment: faint spotlight cone from above, glass top-light
  streak, pedestal contact shadow under the bottle, engraved-style
  accession number (hairline rule under 馆藏编号).
- Image: prefers the transparent world cutout when one exists
  (`PerfumeImage detail` now consults `worldSrcFor`), falling back to the
  product hero otherwise. Rationale: a white-background hero on the dark
  stage reads as a product card, against the brief. C/D class sizing rules
  unchanged (small and quiet).

### Archive — the reading/index room
- Untouched (light touch = none; the brief forbids heavy redesign).

### Shared details
- Hover/focus bottle label is now an archival exhibit plaque: dark plaque,
  hairline frame, lit top rule, small-caps brand, serif name, accession
  number (`No. 0000`), "走近这瓶 ↗". Appears on approach; the field stays clean.
- Random-draw dialog also prefers the world cutout (dark backdrop).
- Motion: Phase 4 settle transitions and drift language kept; reduced-motion
  support intact. No new animation.

## What was deliberately NOT changed
Perfume data, 1,282 mappings, 1600+, exact 1,612, Archive, masters/hero/
card/thumb images, world geometry (`world-model.mjs` untouched — positions,
depth layers, monument interplay all preserved), D-class exclusion and C-class
demotion logic.

## Files changed
- `components/world.css` — mounts, plaques, per-room atmosphere, time rail.
- `components/world-scenes.jsx` — plaque accession no., time rail, rare-room
  accession line, random-draw world image, quarantine filtering (`worldOk`,
  `worldPick` backfill, `FIVE_OK` for the 5★ room).
- `components/library-primitives.jsx` — `detail` prefers world cutout.
- `components/chamber.css` — vitrine (spot cone, glass streak, pedestal
  shadow, accession plaque, rim light).
- `scripts/validate-world.mjs` — fixed missing `.qa/model` build; img-src
  assertions now expect world cutouts per manifest; git scope gate degrades
  honestly when no git repo exists; 5★ loop uses the quarantined-aware list.
- `scripts/validate-library.mjs` — `detail` image assertion now expects the
  world cutout when one exists (matches the shipped Phase 6 behavior).
- `scripts/validate-world-cutouts.mjs` — coverage gate excludes D-class and
  quarantined IDs, computes the true renderable union incl. backfill.

## QA (final, measured 2026-09-19)
- [x] `npm run build` (incl. cutout coverage gate: 900/900) — PASS.
- [x] `npm run validate:data` — PASS (1,612 records, mappings, filters,
      server-rendered routes; `detail` renders world cutout where present).
- [x] `npm run test:smoke` — PASS (entry, 1,612 assets, deep-route fallback).
- [x] `npm run test:world` — PASS:
      9,216 projection checks (1440×900 / 390×844 / 1920×1080 / 768×1024),
      352 rendered world checks, 219 brands, 126 five-star selections,
      17 timeline layers, image mappings. Git scope: DEGRADED (no git repo
      in this environment — honest, not a pass). Browser visual QA: BLOCKED
      by the managed browser's loopback URL policy — not executed, not
      claimed.
- [x] Non-image fields: all 1,612 records' id/rating/year/description/image/
      imageHero asserted equal to source; 1,282 verified mappings and 330
      fallbacks untouched; ratings/names/years/descriptions unmodified.
- [x] Staged room sheets eyeballed (`~/workspace/your_files/room-*.png`):
      entrance, brands, timeline, five — transparent bottles only, no white
      rectangles, no lifestyle props. (Staged approximations, not browser
      screenshots.)
- [x] Full cutout contact sheet + HERO set eyeballed; p0114/p0420/p0027
      remediations verified in situ.
- Known observation (not a blocker): p1254's cutout includes its product
  box beside the bottle (properly segmented; bottle is primary). Packaging-
  only shots found so far (p0027) are quarantined.

## Deployment note
No chatgpt.site publish channel is available in this environment; no Muse
public URL has been created. The pre-Phase-5/6 distribution ZIPs
(`private-scent-library-MUSE-dist.zip`, `private-scent-library-MUSE-site.zip`)
do NOT include this work. A fresh build from this source is required, and it
must use a NEW public URL — never the GPT address
`quiet-scent-archive-rebuilt-2026.nono258.chatgpt.site`, never the original
project ID.
