# Phase 7 — Final visual composition pass (audit)

Date: 2026-09-19. Status: FINAL.

## Brief (user's words, condensed)
Some scenes still feel slightly too dense and collage-like — "a pile of
perfume bottles floating together." Refine spatial composition only:
25–40% fewer prominent bottles in Entrance/Brands/Timeline, more negative
space, clearer museum hierarchy (hero / midground / distant), subtle
contemporary architectural rhythm. Keep cutouts, motion system, data,
mappings, Archive, Object Chamber concept, 5★ concept, 1600+.

## What changed

### Density (visible bottles at one time)
| Scene | Before | After | Reduction |
|---|---|---|---|
| Entrance desktop | 28 | 19 | 32% |
| Entrance lite | 18 | 13 | 28% |
| Entrance mobile (390px) | 12 | 8 | 33% |
| Brands desktop | 16 (8+4+4) | 10 (6+2+2) | 37.5% |
| Brands mobile | 9 (5+2+2) | 6 (4+1+1) | 33% |
| Timeline desktop | 9 | 6 | 33% |
| Timeline mobile | 5 | 3 | 40% |
| 5★ / Object Chamber | — | unchanged | — |

Implementation: `activeCount` shrinks; the render loop keeps all DOM slots
(28/18/12) so SSR `<img>` counts are unchanged and `test:world` stays green.
Dormant slots render `visibility:hidden` + `aria-hidden`, exactly as before.

### Spacing / hierarchy
- `lib/world-model.mjs`: new optional `slotMap` param on `worldPose`
  (backward compatible). The entrance's 19 visible slots map to a curated
  spread of FIELD positions — 4 near heroes / 5 midground / 10 distant
  archive objects — instead of crowding the first 19 near slots:
  `ENTRY_SLOTS` (19), `ENTRY_SLOTS_LITE` (13), `ENTRY_SLOTS_MOBILE` (8).
- Brands: ring radius 13→16 (tucked 19→23), y amplitude 22→26, group offset
  42→46 (mobile 44→48), depth step 36→58, side-group radius 8→10. Cases read
  as separated groups with air between them.
- Timeline: depth step 130→172, lateral amplitude 34→42 (mobile 26→30),
  vertical amplitude 28→32. A procession with spacing, not a cluster.
- Projection math (perspective, travel, drag, parallax) untouched; Phase 4
  motion system (settle, drift, pointer parallax) untouched.

### Architectural rhythm (contemporary, dark — no shelves, no wood)
- `.exhibit-rails`: three thin horizontal hairlines at 29%/56%/83% height,
  edge-faded, the middle one slightly brighter (sight line). Visible in
  entry/brands/time; lives in `.world-atmosphere` behind the bottles.
- `.case-verticals`: very faint vertical hairlines — entry every 340px,
  time every 420px (brands keeps its existing denser mullions).
- Lit plinth top: `.world-object.depth-fg .object-body::before` — a
  barely-there illuminated ellipse under hero exhibits (alpha .075),
  complementing the existing dark shadow-pool.
- All at 3–8% opacity; dark, quiet, restrained.

### Files changed
- `lib/world-model.mjs` — `slotMap` param + `ENTRY_SLOTS*` exports; brands/time
  spacing parameters.
- `components/world-scenes.jsx` — per-scene pick counts, `slotMap` plumbing
  (camera tick + `WorldObject` initial pose + effect deps), atmosphere gains
  `.exhibit-rails` + `.case-verticals`.
- `components/world.css` — rails, verticals, plinth-glow styles.

## What was deliberately NOT changed
Perfume data, 1,282 verified mappings, 900 world cutouts, Archive, Object
Chamber concept, 5★ concept, 1600+, exact 1,612, D-class exclusion, C-class
demotion, coverage gate, motion system, FIELD/MOBILE position tables
(only the *selection* and *spacing parameters* changed).

## QA (final, measured 2026-09-19)
- [x] `npm run build` (incl. cutout coverage gate 900/900) — PASS.
- [x] `npm run validate:data` — PASS (1,612 records; id/rating/year/
      description/image asserted equal to source).
- [x] `npm run test:smoke` — PASS (entry, 1,612 assets, deep-route fallback).
- [x] `npm run test:world` — PASS: 28 hero / 12 mobile / 18 lite SSR images,
      9,216 projection checks, 352 rendered world checks, all 219 brands,
      all 126 five-star selections, all 17 time layers, image mappings.
      Git scope gate: DEGRADED (no git repo in this environment — honest,
      not a pass). Browser visual QA: BLOCKED (managed Chromium loopback
      policy) — not executed, not claimed.
- [x] `work/geom-check.mjs` — no bottle overlaps the 390px title at
      375/390/430 widths.
- [x] Pairwise bottle-overlap analysis on the new visible sets (real
      worldPose, 1440): entrance 0 pairs, brands 1 pair at 10% area
      (minor, different depths), timeline 0, entrance-390 0.
- [x] Staged QA sheets eyeballed (`~/workspace/your_files/room2-*.png`,
      desktop 1440 + mobile 390, real poses + real cutouts): entrance reads
      as a grand hall with 4 heroes / 5 mid / 10 distant; brands reads as
      three separated cases; timeline reads as a spaced procession; 5★ and
      chamber unchanged and clean. No white rectangles, no halos, no
      regressions. Sheets are staged approximations, not browser screenshots.
- Known observation (not a blocker): staged brands sheet randomly picked a
  packaging cutout (Stella box) from the A/B manifest — real brand views use
  that brand's top-rated items; packaging-only shots remain quarantined per
  Phase 5 policy.

## Deployment note
No publish channel in this environment; no Muse public URL created. Fresh
dist/site/slim-handoff zips built as `*-phase7.zip`; they must ship under a
NEW public URL — never the GPT address, never the original project ID.

## Phase 7 freeze — Stella/Gucci overlap fix (2026-09-19, final)

The Phase 7 composition pass left one minor imperfection: in the Brands case
(desktop), the case hero (group-0 slot 0) and slot 5 sat ~10% of the smaller
bottle's area into each other (measured with real worldPose geometry + real
cutout aspect ratios: 9.6%). Staged sheet happened to show Stella McCartney
(p1606, 斯特拉·同名女士) overlapping Gucci (p0571, 古驰·艺术女神) — the same
geometric pair, bottle identity is data-driven, not special-cased.

Fix (local only, `lib/world-model.mjs`, brands branch): group-0 desktop slot 5
gets `x += 10; y -= 6` within its own case. No other file touched for the
composition change. Visible counts unchanged (Brands 10/6, Entrance 19/13/8,
Timeline 6/3), depth hierarchy unchanged, Entrance/Timeline/5★/Object
Chamber/motion/cutouts/mappings/data/Archive/1600+ all untouched.

Re-verified after the fix (all measured 2026-09-19):
- Brands geometric QA (real worldPose, real cutout aspects, 1440 + 390):
  zero pairwise bottle overlaps. No new label/UI overlaps introduced. Two
  pre-existing notes, both unchanged by this fix and both out of freeze scope:
  (a) bottles drift in front of the brand-name watermark by design (z-index 17
  watermark vs z ≤ 30 bottles — same treatment as the entrance 1600+ monument);
  (b) brands-390 slot 2 sits under the room-intimacy title region (88.6%,
  identical before/after; desktop-only fix did not touch it).
- `npm run build` — PASS (900/900 cutout coverage gate).
- `npm run validate:data` — PASS (1,612 records).
- `npm run test:smoke` — PASS (entry, 1,612 assets, deep-route fallback).
- `npm run test:world` — PASS: 9,216 projection checks, 352 rendered checks,
  219 brands, 126 five-star, 17 time layers, image mappings. Git scope gate
  DEGRADED (no git repo here — honest, not a pass). Browser visual QA BLOCKED
  (managed Chromium loopback policy) — staged composites only.
- Data byte-unchanged: `data/collection.json` md5 prefix still
  `6023ed953cacff4e`; 1,612 records; 1,282 canonical `_card.webp` mappings +
  330 fallbacks — identical to the Phase 7 audit.
- Brands QA sheets regenerated with the fixed geometry and identical bottle
  identity (deterministic replay): `room2-brands-1440.png` (overlap gone, air
  between the pair), `room2-brands-390.png` (unchanged). No other sheet touched.
- Packages regenerated into `files/` with identical filenames and method
  (slim = phase4 baseline + synced source changes; dist/site = fresh build):
  `private-scent-library-slim-handoff-phase7.zip`,
  `private-scent-library-MUSE-dist-phase7.zip`,
  `private-scent-library-MUSE-site-phase7.zip` — all `unzip -t` clean.

FREEZE: the Muse branch is frozen at this state. No further visual
experimentation or conceptual changes. Only files modified in this fix:
`lib/world-model.mjs` (the slot-5 nudge), `audit/phase7_composition.md`
(this note), plus build-regenerated `.qa/` snapshots and the repackaged zips.
