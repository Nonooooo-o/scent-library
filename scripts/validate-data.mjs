import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const records = JSON.parse(fs.readFileSync(path.join(root, "data/perfumes.json"), "utf8"));
const required = [
  "id",
  "brand",
  "brandSlug",
  "nameChinese",
  "nameEnglish",
  "personalRating",
  "imageThumbnail",
  "imageLarge",
  "informationSources",
  "verificationStatus",
];
const errors = [];
const ids = new Set();

for (const [index, record] of records.entries()) {
  for (const field of required) {
    if (record[field] === null || record[field] === undefined || record[field] === "") {
      errors.push(`record ${index + 1}: missing ${field}`);
    }
  }
  if (ids.has(record.id)) errors.push(`duplicate id: ${record.id}`);
  ids.add(record.id);
  if (!Number.isInteger(record.personalRating) || record.personalRating < 1 || record.personalRating > 5) {
    errors.push(`${record.id}: invalid rating`);
  }
  if (
    record.releaseYear !== null &&
    (!Number.isInteger(record.releaseYear) || record.releaseYear < 1700 || record.releaseYear > 2100)
  ) {
    errors.push(`${record.id}: invalid year`);
  }
  for (const listField of [
    "topNotes",
    "middleNotes",
    "baseNotes",
    "mainAccords",
    "perfumer",
    "seasons",
    "timeOfDay",
    "occasions",
    "informationSources",
  ]) {
    if (!Array.isArray(record[listField])) errors.push(`${record.id}: ${listField} must be an array`);
  }
  if (record.description && (record.description.length < 80 || record.description.length > 180)) {
    errors.push(`${record.id}: description must contain 80–180 characters`);
  }
  const thumbnailPath = path.join(root, "public", record.imageThumbnail.replace(/^\//, ""));
  if (!fs.existsSync(thumbnailPath)) errors.push(`${record.id}: missing thumbnail`);
  const largePath = path.join(root, "public", record.imageLarge.replace(/^\//, ""));
  if (!fs.existsSync(largePath)) errors.push(`${record.id}: missing large image or placeholder`);
}

if (records.length !== 1612) errors.push(`expected 1612 records, found ${records.length}`);
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

const counts = records.reduce((map, record) => {
  map[record.personalRating] = (map[record.personalRating] || 0) + 1;
  return map;
}, {});
console.log(
  JSON.stringify({
    records: records.length,
    brands: new Set(records.map((record) => record.brand)).size,
    ratings: counts,
    missingYear: records.filter((record) => record.releaseYear === null).length,
    descriptions: records.filter((record) => record.description).length,
    completePyramids: records.filter(
      (record) => record.topNotes.length && record.middleNotes.length && record.baseNotes.length
    ).length,
    verifiedImages: records.filter((record) => record.imageVerificationStatus === "verified").length,
    verifiedInformation: records.filter((record) => record.verificationStatus === "verified").length,
  })
);
