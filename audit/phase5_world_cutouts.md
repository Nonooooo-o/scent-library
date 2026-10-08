# Phase 5 — Transparent world cutouts (audit)

Date: 2026-09-19. Status: FINAL.

## Intent
Separate the immersive world's image system from the product-photo system.
World scenes (entrance, Explore, Brands, Timeline, 5★ room, floating
compositions, Object Chamber vitrine, random-draw dialog) render a NEW
transparent-background derivative: `public/thumbnails/<id>_world.webp`.
Archive / Search / informational layouts keep the PRODUCT image (white bg is
fine there). Masters, hero, card, thumb derivatives are never overwritten.

## Tooling (spike-approved)
- Primary: `rembg` + `u2net` (model cached at `~/.u2net/u2net.onnx`, offline OK).
- Fallback, GATED: OpenCV border flood-fill → GrabCut → 1px alpha erode +
  feather → white-fringe despill. Fires ONLY when
  `dark_cov > 20 AND u2net_cov < 0.45 × dark_cov` (validated on the 12-bottle
  spike: fires on the single true u2net dark-bottle miss, stays off on all
  11 good cases including pale/white bottles).
- `isnet-general-use` tested and REJECTED (also dropped the dark bottle).
- Naive global white-pixel removal was NEVER used.
- Output spec: ≤800px long edge, WebP alpha q90, trimmed to alpha bbox + 8px.
- Pipeline: `~/workspace/private-scent-library/work/cutout_spike/cutout.py`
  (spike), `~/workspace/private-scent-library/work/batch_cutout.py` (batch).
- QC gates → quarantine (never ship): obj_pct > 96 (rectangle remnant),
  obj_pct < 12 (over-erased), edge_white_frac > .35 (halo fringe).

## Scope
- Full interactive union of every bottle the immersive world can render
  (all Brands clusters, all Timeline decades, all 5★ + companions, Explore
  field variants, entrance HERO set): **912 IDs**
  (`~/workspace/private-scent-library/work/world_cutout_full_union.json`).
- D-class placeholders (2 in union): NO cutout — swapped out in scene
  selection code (`worldPick`/`notDWorld` with backfill). Never prominent.
- Batch target: **910 IDs**.

## Batch execution
- Started 2026-09-19 00:54 PDT. Process died silently ~01:04 PDT at 125/910
  (no error in log; likely VM/process reclamation). Resumed 02:26 PDT with
  the same resume-safe script (skips existing outputs).
- Log: `~/workspace/private-scent-library/work/batch_progress.log`;
  per-image QC: `~/workspace/private-scent-library/work/world_cutout_batch_qc.jsonl`.

## Results (final, 2026-09-19)
- Shipped: **900** world cutouts (`public/thumbnails/<id>_world.webp`,
  ≤800px long edge, WebP alpha q90, trimmed to alpha bbox + 8px).
- Quarantined: **16** (see `audit/world_cutouts_quarantine.csv`;
  `data/world-cutouts-quarantined.json`). No world file, not in manifest,
  excluded from every immersive selection with backfill.
- Guardrail (GrabCut fallback) fires: 20 (batch) — gated, validated.
- Zero-byte recovery: `p0255_world.webp` (first-run crash artifact) deleted
  and reprocessed clean (`obj_pct=82.89`, `edge_white_frac=0.0527`).
- Manual remediations (eyeballed clean on dark): p0545, p0847, p1084, p1088,
  p1534 (pipeline output); p0723, p1240, p1393, p1438 (u2net-only after
  GrabCut misfire).
- `p0114` (HERO): lifestyle source had clementine props. Isolated the
  bottle via connected-components + orange/brown color masks; eyeballed
  clean; replaced the world derivative.
- `p0420` (5★): hand holding the bottle in all sources. Quarantined;
  the 5★ room now floats 126 (FIVE_OK filter; accession line is dynamic).
- `p0027`: packaging tube only, no bottle. Quarantined.
- Backfill: 5 union-external bottles (p0141, p0142, p0983, p1501, p1503)
  + p0041 (p0027 backfill) processed through the same pipeline; all shipped.
- Coverage: `npm run build` runs `scripts/validate-world-cutouts.mjs` —
  **900/900 renderable IDs in manifest, 0 quarantined overlap. PASS.**

## Manifest
- `data/world-cutouts.json`: `{ "<id>": "thumbnails/<id>_world.webp" }`,
  900 entries, regenerated after the batch. Consumed by `worldSrcFor()` in
  `components/library-primitives.jsx`.

## QA (final)
- [x] Full contact sheet on #0a0a0c grouped by class — eyeballed for white
      rectangles / halos / destroyed labels. (`~/workspace/your_files/`
      `cutout-batch-sheet.png` + `sheet-top/mid/bot.png`; suspects reviewed
      separately.)
- [x] HERO set re-checked (28, no D, no quarantine); p0114 fixed.
- [x] `npm run build` / `validate:data` / `test:smoke` / `test:world` green
      (see Phase 6 audit for the measured report).
- [x] Non-image fields: `validate:data` asserts all 1,612 records'
      id/rating/year/description/image/imageHero equal the Phase 4 source;
      1,282 mappings + 330 fallbacks untouched.
- [ ] Real-browser visual QA: BLOCKED by the managed browser's loopback
      policy — staged composites only, honestly labeled.

## Deliberately NOT changed
Perfume data (names, ratings, years, descriptions, order), the 1,282
verified mappings, the 1600+ art number, the exact 1,612 count, Archive
structure, masters/hero/card/thumb images.
