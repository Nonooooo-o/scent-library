#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "$0")/.." && pwd)"
source_dir="$root_dir/public/perfumes"
target_dir="$root_dir/public/thumbnails"

if ! command -v convert >/dev/null 2>&1; then
  echo "ImageMagick 'convert' is required to generate thumbnails." >&2
  exit 1
fi

mkdir -p "$target_dir"

generated=0
for source in "$source_dir"/*.png; do
  filename="$(basename "${source%.png}")"
  target="$target_dir/$filename.webp"

  if [[ ! -f "$target" || "$source" -nt "$target" ]]; then
    convert "$source" -background none -alpha on -resize '240x240>' -strip -quality 82 "$target"
    generated=$((generated + 1))
  fi
done

echo "Thumbnail generation complete: $generated updated, $(find "$target_dir" -type f -name '*.webp' | wc -l | tr -d ' ') total."
