import fs from "node:fs";
import { filterAndSortPerfumes } from "../lib/archive-utils.mjs";

const perfumes = JSON.parse(fs.readFileSync("data/perfumes.json", "utf8"));

function expect(label, actual, expected) {
  if (actual !== expected) throw new Error(`${label}: expected ${expected}, received ${actual}`);
  console.log(`${label}: ${actual}`);
}

expect("中文名搜索", filterAndSortPerfumes(perfumes, { query: "棉花与杏仁" }).length, 1);
expect("英文名搜索", filterAndSortPerfumes(perfumes, { query: "Cotton & Almond" }).length, 1);
expect("品牌搜索", filterAndSortPerfumes(perfumes, { query: "4711" }).length, 24);
expect("品牌筛选", filterAndSortPerfumes(perfumes, { brand: "4711" }).length, 24);
expect("五星筛选", filterAndSortPerfumes(perfumes, { rating: 5 }).length, 127);
expect("组合筛选", filterAndSortPerfumes(perfumes, { brand: "4711", rating: 5 }).length, 1);
expect("年份筛选", filterAndSortPerfumes(perfumes, { year: 2019 }).every((item) => item.releaseYear === 2019), true);
expect(
  "图片状态筛选",
  filterAndSortPerfumes(perfumes, { verification: "image-pending" }).every(
    (item) => item.imageVerificationStatus !== "verified"
  ),
  true
);
expect("评分降序", filterAndSortPerfumes(perfumes, { sort: "ratingDesc" })[0].personalRating, 5);
expect("评分升序", filterAndSortPerfumes(perfumes, { sort: "ratingAsc" })[0].personalRating, 1);
expect("年份降序", filterAndSortPerfumes(perfumes, { sort: "yearDesc" })[0].releaseYear, 2023);
expect("分页页数", Math.ceil(perfumes.length / 24), 68);
