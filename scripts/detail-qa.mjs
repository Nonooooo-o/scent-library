import fs from "node:fs";

const perfumes = JSON.parse(fs.readFileSync("data/perfumes.json", "utf8"));
const sampleIndexes = [7, 63, 118, 194, 271, 347, 426, 502, 579, 655, 731, 808, 884, 960, 1037, 1113, 1190, 1266, 1420, 1579];
const failures = [];
const checked = [];

for (const index of sampleIndexes) {
  const perfume = perfumes[index];
  if (!perfume) {
    failures.push(`missing sample index ${index}`);
    continue;
  }
  if (!perfume.id || !perfume.brand || !perfume.nameChinese || !perfume.nameEnglish) {
    failures.push(`${perfume.id}: missing identity field`);
  }
  if (!Number.isInteger(perfume.personalRating) || perfume.personalRating < 1 || perfume.personalRating > 5) {
    failures.push(`${perfume.id}: personal rating changed or invalid`);
  }
  if (perfume.description && (perfume.description.length < 80 || perfume.description.length > 180)) {
    failures.push(`${perfume.id}: invalid description length`);
  }
  for (const source of perfume.informationSources) {
    if (!source.label || !/^https:\/\//.test(source.url)) failures.push(`${perfume.id}: invalid source link`);
  }
  checked.push({
    id: perfume.id,
    name: perfume.nameChinese,
    rating: perfume.personalRating,
    description: Boolean(perfume.description),
    completePyramid: Boolean(perfume.topNotes.length && perfume.middleNotes.length && perfume.baseNotes.length),
    status: perfume.verificationStatus,
  });
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(JSON.stringify({ checked: checked.length, records: checked }, null, 2));
