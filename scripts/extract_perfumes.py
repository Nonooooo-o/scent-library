#!/usr/bin/env python3
"""Extract the perfume archive records and their embedded images from a DOCX."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from collections import Counter, defaultdict
from pathlib import Path

from docx import Document


RATING_RE = re.compile(r"([1-5])\s*/\s*5")
YEAR_RE = re.compile(r",\s*(\d{4})\s*$")
HAN_RE = re.compile(r"[\u3400-\u4dbf\u4e00-\u9fff]")
EMBED_ATTR = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}embed"


def split_title(value: str) -> tuple[str, str, int | None]:
    """Split the source's Chinese title, English title and optional trailing year."""
    value = value.strip()
    year_match = YEAR_RE.search(value)
    year = int(year_match.group(1)) if year_match else None
    title = value[: year_match.start()].rstrip() if year_match else value

    # The English title is the first remaining suffix with no Han characters.
    # This safely skips Latin characters that occur inside a Chinese title.
    for gap in re.finditer(r"\s+", title):
        left = title[: gap.start()].strip()
        right = title[gap.end() :].strip()
        if left and right and HAN_RE.search(left) and not HAN_RE.search(right):
            return left, right, year
    return title, "", year


def split_with_marker(title: str, marker: str) -> tuple[str, str] | None:
    """Refine a split with the brand's recurring first English token."""
    marker_pattern = re.compile(rf"(?<!\S){re.escape(marker)}(?=\s|$)")
    for match in marker_pattern.finditer(title):
        left = title[: match.start()].strip()
        right = title[match.start() :].strip()
        if len(left.split()) >= 2 and right and not HAN_RE.search(right):
            return left, right
    return None


def previous_nonempty(paragraphs, index: int) -> str:
    index -= 1
    while index >= 0:
        value = paragraphs[index].text.strip()
        if value:
            return value
        index -= 1
    return ""


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("project", type=Path)
    args = parser.parse_args()

    data_dir = args.project / "data"
    image_dir = args.project / "public" / "perfumes"
    data_dir.mkdir(parents=True, exist_ok=True)
    image_dir.mkdir(parents=True, exist_ok=True)

    document = Document(args.source)
    paragraphs = document.paragraphs
    rows: list[dict] = []
    current_group = ""

    for index, paragraph in enumerate(paragraphs):
        text = paragraph.text.strip()
        if not text:
            continue

        rating_match = RATING_RE.fullmatch(text)
        if not rating_match:
            next_index = index + 1
            while next_index < len(paragraphs) and not paragraphs[next_index].text.strip():
                next_index += 1
            if (
                next_index < len(paragraphs)
                and not RATING_RE.fullmatch(paragraphs[next_index].text.strip())
            ):
                current_group = text
            continue

        source_title = previous_nonempty(paragraphs, index)
        zh_title, en_title, year = split_title(source_title)
        initial_brand = zh_title.split(maxsplit=1)[0] if zh_title else current_group
        blips = paragraph._p.xpath(".//a:blip")
        if len(blips) != 1:
            raise ValueError(f"Expected exactly one image for record near paragraph {index}")
        relationship_id = blips[0].get(EMBED_ATTR)
        image_part = document.part.rels[relationship_id].target_part

        rows.append(
            {
                "source_title": source_title,
                "title_without_year": YEAR_RE.sub("", source_title).strip(),
                "zh_title": zh_title,
                "en_title": en_title,
                "initial_brand": initial_brand,
                "group": current_group.removesuffix("系列").strip(),
                "year": year,
                "rating": int(rating_match.group(1)),
                "image_blob": image_part.blob,
            }
        )

    if len(rows) != 1612:
        raise ValueError(f"Expected 1612 records, found {len(rows)}")

    # Infer the recurring first English token for each brand. This corrects titles
    # whose Chinese display name is itself Latin or numeric (for example "1996").
    marker_counts: dict[str, Counter[str]] = defaultdict(Counter)
    for row in rows:
        if row["en_title"]:
            marker_counts[row["initial_brand"]][row["en_title"].split()[0]] += 1

    for row in rows:
        counts = marker_counts[row["initial_brand"]]
        marker = counts.most_common(1)[0][0] if counts else ""
        refined = split_with_marker(row["title_without_year"], marker) if marker else None
        if refined:
            row["zh_title"], row["en_title"] = refined

    brands = sorted(
        {row["zh_title"].split(maxsplit=1)[0] for row in rows},
        key=lambda value: value.casefold(),
    )
    brand_slugs = {
        brand: "b-" + hashlib.sha1(brand.encode("utf-8")).hexdigest()[:10]
        for brand in brands
    }

    records: list[dict] = []
    for position, row in enumerate(rows, start=1):
        perfume_id = f"p{position:04d}"
        zh_parts = row["zh_title"].split(maxsplit=1)
        brand = zh_parts[0]
        name_zh = zh_parts[1] if len(zh_parts) > 1 else None
        image_name = f"{perfume_id}.png"
        (image_dir / image_name).write_bytes(row["image_blob"])

        records.append(
            {
                "id": perfume_id,
                "brand": brand,
                "brandSlug": brand_slugs[brand],
                "nameZh": name_zh,
                "nameEn": row["en_title"] or None,
                "year": row["year"],
                "rating": row["rating"],
                "image": f"/perfumes/{image_name}",
            }
        )

    missing_names = [record["id"] for record in records if not record["nameZh"] or not record["nameEn"]]
    if missing_names:
        raise ValueError(f"Name split failed for: {', '.join(missing_names)}")

    (data_dir / "perfumes.json").write_text(
        json.dumps(records, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    audit = {
        "records": len(records),
        "brands": len({record["brand"] for record in records}),
        "ratings": dict(sorted(Counter(record["rating"] for record in records).items())),
        "missingYear": sum(record["year"] is None for record in records),
        "images": len(list(image_dir.glob("*.png"))),
    }
    (data_dir / "import-audit.json").write_text(
        json.dumps(audit, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(audit, ensure_ascii=False))


if __name__ == "__main__":
    main()
