// Phase 5: every bottle the immersive world can render (across all interactive
// states) must have a transparent world cutout — unless it is D-class, which
// the world scenes deliberately swap out, or its auto cutout was quarantined
// (audit/world_cutouts_quarantine.csv; world-scenes.jsx backfills around them).
// Fails the build loudly otherwise.
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const R = p => path.join(ROOT, p);

const wm = fs.readFileSync(R("lib/world-model.mjs"), "utf8");
const HERO_IDS = [...wm.match(/HERO_IDS=\[([^\]]+)\]/)[1].matchAll(/'([^']+)'/g)].map(m => m[1]);

const collection = JSON.parse(fs.readFileSync(R("data/collection.json"), "utf8"));
const classes = JSON.parse(fs.readFileSync(R("data/image-classes.json"), "utf8"));
const manifest = JSON.parse(fs.readFileSync(R("data/world-cutouts.json"), "utf8"));
const quarantined = new Set(JSON.parse(fs.readFileSync(R("data/world-cutouts-quarantined.json"), "utf8")).ids);
const renderable = p => (classes[p.id] || "B") !== "D" && !quarantined.has(p.id);

// Mirror of components/world-scenes.jsx selection logic (desktop counts).
const union = new Set(HERO_IDS);
const grouped = new Map();
for (const p of collection) {
  if (!grouped.has(p.brand)) grouped.set(p.brand, []);
  grouped.get(p.brand).push(p);
}
for (const items of grouped.values())
  for (const p of [...items].sort((a, b) => b.personalRating - a.personalRating).filter(renderable).slice(0, 8))
    union.add(p.id);
const decades = [...new Set(collection.map(p => p.releaseYear).filter(Boolean).map(y => Math.floor(y / 10) * 10))];
for (const d of decades) {
  const items = collection
    .filter(p => p.releaseYear && Math.floor(p.releaseYear / 10) * 10 === d && renderable(p))
    .sort((a, b) => a.releaseYear - b.releaseYear || b.personalRating - a.personalRating)
    .slice(0, 9);
  for (const p of items) union.add(p.id);
}
for (const p of collection) if (p.personalRating === 5 && renderable(p)) union.add(p.id);

const missing = [];
for (const id of [...union].sort()) {
  const file = R(`public/thumbnails/${id}_world.webp`);
  if (!manifest[id] || !fs.existsSync(file)) missing.push(id);
}
const dangling = Object.keys(manifest).filter(id => !fs.existsSync(R(`public/thumbnails/${id}_world.webp`)));

console.log(`world cutouts: ${union.size} renderable ids, ${Object.keys(manifest).length} in manifest`);
if (missing.length) {
  console.error(`MISSING world cutouts for ${missing.length} renderable ids:\n  ${missing.join(", ")}`);
  process.exit(1);
}
if (dangling.length) {
  console.error(`dangling manifest entries (no file): ${dangling.join(", ")}`);
  process.exit(1);
}
console.log("world cutout coverage OK");
