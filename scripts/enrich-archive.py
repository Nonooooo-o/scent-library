#!/usr/bin/env python3
"""Build a source-backed perfume archive and local image derivatives.

The script deliberately favours unresolved records over risky matches. A source
record is accepted only when brand/name evidence is strong and the supplied year
and concentration do not conflict with the original archive.
"""

from __future__ import annotations

import argparse
import csv
import difflib
import html
import io
import json
import os
import re
import shutil
import sys
import time
import unicodedata
import urllib.error
import urllib.request
import zipfile
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable

from PIL import Image, ImageOps


ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / ".research-cache"
PARFUMO_CSV = CACHE / "parfumo_data_clean.csv"
FRAGRANTICA_ZIP = CACHE / "fragrantica-dataset.zip"
FRAGRANTICA_CSV = CACHE / "fragrantica" / "fra_cleaned.csv"
DATA_PATH = ROOT / "data" / "perfumes.json"
AUDIT_PATH = ROOT / "data" / "research-audit.json"
LARGE_DIR = ROOT / "public" / "large"
THUMB_DIR = ROOT / "public" / "thumbnails"
ORIGINAL_DIR = ROOT / "public" / "perfumes"
PAGE_CACHE = CACHE / "parfumo-pages"
DOWNLOAD_CACHE = CACHE / "images"

PARFUMO_DATA_URL = (
    "https://raw.githubusercontent.com/rfordatascience/tidytuesday/main/"
    "data/2024/2024-12-10/parfumo_data_clean.csv"
)
FRAGRANTICA_DATA_URL = (
    "https://www.kaggle.com/api/v1/datasets/download/"
    "olgagmiufana1/fragrantica-com-fragrance-dataset?datasetVersionNumber=3"
)
PARFUMO_DATASET_SOURCE = (
    "https://github.com/rfordatascience/tidytuesday/tree/main/data/2024/2024-12-10"
)
FRAGRANTICA_DATASET_SOURCE = (
    "https://www.kaggle.com/datasets/olgagmiufana1/fragrantica-com-fragrance-dataset"
)

CONCENTRATIONS = (
    ("Extrait de Parfum", ("extrait", "de", "parfum")),
    ("Eau de Parfum", ("eau", "de", "parfum")),
    ("Eau de Toilette", ("eau", "de", "toilette")),
    ("Eau de Cologne", ("eau", "de", "cologne")),
    ("Eau sans Alcool", ("eau", "sans", "alcool")),
    ("Body Spray", ("body", "spray")),
    ("Hair Mist", ("hair", "mist")),
    ("Perfume Oil", ("perfume", "oil")),
    ("Parfum", ("parfum",)),
    ("EDP", ("edp",)),
    ("EDT", ("edt",)),
    ("EDC", ("edc",)),
)

GENERIC_WORDS = {
    "a", "an", "and", "by", "da", "de", "di", "du", "el", "en", "for",
    "la", "le", "les", "of", "pour", "the",
}

ACCORD_ZH = {
    "aromatic": "芳香", "amber": "琥珀", "animalic": "动物感", "aquatic": "水生",
    "balsamic": "香脂", "citrus": "柑橘", "earthy": "泥土", "floral": "花香",
    "fresh": "清新", "fresh spicy": "清新辛香", "fruity": "果香", "gourmand": "美食",
    "green": "绿意", "herbal": "草本", "leathery": "皮革", "marine": "海洋",
    "metallic": "金属感", "mossy": "苔藓", "musky": "麝香", "oriental": "东方",
    "powdery": "粉感", "resinous": "树脂", "smoky": "烟熏", "soapy": "皂感",
    "spicy": "辛香", "sweet": "甜香", "tobacco": "烟草", "tropical": "热带果香",
    "vanilla": "香草", "warm spicy": "温暖辛香", "white floral": "白花", "woody": "木质",
    "yellow floral": "黄花", "ozonic": "空气感", "salty": "咸感", "creamy": "奶油感",
}

NOTE_ZH = {
    "aldehydes": "醛", "almond": "杏仁", "amber": "琥珀", "ambergris": "龙涎香",
    "ambrette": "黄葵籽", "anise": "茴香", "apple": "苹果", "apricot": "杏",
    "basil": "罗勒", "benzoin": "安息香", "bergamot": "佛手柑", "birch": "桦木",
    "black currant": "黑加仑", "black pepper": "黑胡椒", "blood orange": "血橙",
    "cardamom": "小豆蔻", "cashmere wood": "羊绒木", "cedar": "雪松",
    "cedarwood": "雪松", "chamomile": "洋甘菊", "cinnamon": "肉桂", "clary sage": "快乐鼠尾草",
    "clove": "丁香", "coconut": "椰子", "coffee": "咖啡", "coriander": "芫荽",
    "cotton": "棉花", "cypress": "丝柏", "elemi": "榄香脂", "eucalyptus": "桉树",
    "fig": "无花果", "frankincense": "乳香", "frankincense resin": "乳香树脂",
    "freesia": "小苍兰", "galbanum": "白松香", "gardenia": "栀子花", "geranium": "天竺葵",
    "ginger": "生姜", "grapefruit": "葡萄柚", "green apple": "青苹果", "green notes": "绿叶",
    "hawthorn": "山楂花", "heliotrope": "天芥菜", "honey": "蜂蜜", "incense": "焚香",
    "iris": "鸢尾", "jasmine": "茉莉", "juniper": "杜松", "labdanum": "劳丹脂",
    "lavender": "薰衣草", "leather": "皮革", "lemon": "柠檬", "lily": "百合",
    "lily-of-the-valley": "铃兰", "lime": "青柠", "litchi": "荔枝", "lychee": "荔枝",
    "magnolia": "木兰", "mandarin orange": "橘子", "mimosa": "含羞草", "mint": "薄荷",
    "moss": "苔藓", "musk": "麝香", "myrrh": "没药", "neroli": "橙花油",
    "nutmeg": "肉豆蔻", "oakmoss": "橡木苔", "orange": "橙", "orange blossom": "橙花",
    "orris": "鸢尾根", "osmanthus": "桂花", "oud": "沉香", "patchouli": "广藿香",
    "peach": "桃子", "pear": "梨", "pepper": "胡椒", "petitgrain": "苦橙叶",
    "pine": "松针", "pink pepper": "粉红胡椒", "plum": "李子", "rose": "玫瑰",
    "rosemary": "迷迭香", "saffron": "藏红花", "sandalwood": "檀香", "tobacco": "烟草",
    "tonka bean": "零陵香豆", "tonka bean absolute": "零陵香豆原精", "tuberose": "晚香玉",
    "vanilla": "香草", "vetiver": "香根草", "violet": "紫罗兰", "violet leaf": "紫罗兰叶",
    "white musk": "白麝香", "woodsy notes": "木质香", "ylang-ylang": "依兰",
    "agarwood (oud)": "沉香", "woody notes": "木质香", "orris root": "鸢尾根",
    "carnation": "康乃馨", "olibanum": "乳香", "guaiac wood": "愈创木", "cloves": "丁香",
    "bitter orange": "苦橙", "raspberry": "覆盆子", "peony": "牡丹", "artemisia": "蒿草",
    "narcissus": "水仙", "tea": "茶", "spices": "辛香料", "citruses": "柑橘",
    "ambrette (musk mallow)": "黄葵籽", "castoreum": "海狸香", "tangerine": "橘子",
    "sage": "鼠尾草", "pineapple": "菠萝", "caraway": "葛缕子", "oak moss": "橡木苔",
    "orchid": "兰花", "brazilian rosewood": "巴西花梨木", "juniper berries": "杜松子",
    "ambroxan": "龙涎酮", "jasmine sambac": "沙巴茉莉", "angelica": "当归",
    "cyclamen": "仙客来", "cypriol oil or nagarmotha": "莎草", "civet": "灵猫香",
    "amalfi lemon": "阿马尔菲柠檬", "styrax": "苏合香", "turkish rose": "土耳其玫瑰",
    "african orange flower": "非洲橙花", "tarragon": "龙蒿", "cumin": "孜然",
    "green tea": "绿茶", "cashmeran": "开司米酮", "honeysuckle": "金银花",
    "caramel": "焦糖", "vanille": "香草", "suede": "麂皮", "lilac": "紫丁香",
    "may rose": "五月玫瑰", "calabrian bergamot": "卡拉布里亚佛手柑", "tolu balsam": "吐鲁香脂",
    "white flowers": "白花", "damask rose": "大马士革玫瑰", "opoponax": "甜没药",
    "immortelle": "蜡菊", "rum": "朗姆酒", "yuzu": "柚子", "citron": "香橼",
    "thyme": "百里香", "rhubarb": "大黄", "star anise": "八角", "haitian vetiver": "海地香根草",
    "sea notes": "海洋气息", "balsam fir": "冷杉香脂", "lotus": "莲花", "resins": "树脂",
    "fig leaf": "无花果叶", "lemon verbena": "柠檬马鞭草", "powdery notes": "粉感香气",
    "green leaves": "绿叶", "hyacinth": "风信子", "wormwood": "苦艾", "french labdanum": "法国劳丹脂",
    "carrot seeds": "胡萝卜籽", "myrhh": "没药", "spicy notes": "辛香料", "papyrus": "纸莎草",
    "hedione": "二氢茉莉酮酸甲酯", "beeswax": "蜂蜡", "cacao": "可可", "sichuan pepper": "花椒",
    "blackberry": "黑莓", "hiacynth": "风信子", "mate": "马黛茶", "fruity notes": "果香",
    "peru balsam": "秘鲁香脂", "amyris": "阿米香树", "white amber": "白琥珀", "cassis": "黑加仑",
    "amberwood": "琥珀木", "rose de mai": "五月玫瑰", "oak": "橡木", "floral notes": "花香",
    "clementine": "克莱门氏小柑橘", "milk": "牛奶", "pomegranate": "石榴", "water lily": "睡莲",
    "frangipani": "鸡蛋花", "atlas cedar": "阿特拉斯雪松", "melon": "甜瓜", "pomelo": "柚子",
    "red berries": "红色浆果", "water notes": "水生气息", "dried fruits": "干果", "vetyver": "香根草",
    "madagascar vanilla": "马达加斯加香草", "mango": "芒果", "tiare flower": "大溪地栀子花",
    "gaiac wood": "愈创木", "grass": "青草", "calone": "西瓜酮", "hay": "干草",
    "licorice": "甘草", "solar notes": "日光气息", "clover": "三叶草", "elemi resin": "榄香脂",
    "cassia": "桂皮", "bamboo": "竹子", "red apple": "红苹果", "sea water": "海水",
    "tobacco leaf": "烟草叶", "white woods": "白木", "praline": "果仁糖", "hibiscus": "木槿",
    "sea salt": "海盐", "ivy": "常春藤", "precious woods": "珍贵木材", "iso e super": "Iso E Super",
    "rhuburb": "大黄", "virginian cedar": "弗吉尼亚雪松", "watermelon": "西瓜", "pimento": "多香果",
    "smoke": "烟熏", "coumarin": "香豆素", "rice": "米香", "fir": "冷杉", "moroccan rose": "摩洛哥玫瑰",
    "sicilian lemon": "西西里柠檬", "indonesian patchouli": "印度尼西亚广藿香", "pine tree": "松树",
    "flowers": "花香", "tagetes": "万寿菊", "bay leaf": "月桂叶", "marigold": "金盏花",
    "tunisian neroli": "突尼斯橙花油", "sugar": "糖", "strawberry": "草莓", "passionfruit": "百香果",
    "resin": "树脂", "watery notes": "水润气息", "mastic or lentisque": "乳香黄连木", "cherry": "樱桃",
    "green mandarin": "青橘", "cherry blossom": "樱花", "white peach": "白桃", "bourbon vanilla": "波旁香草",
    "sicilian mandarin": "西西里橘", "copahu balm": "古巴香脂", "peach blossom": "桃花", "myrtle": "香桃木",
    "palisander rosewood": "花梨木", "cardamon": "小豆蔻", "pink grapefruit": "粉红葡萄柚",
    "black tea": "红茶", "champaca": "黄兰", "siam benzoin": "暹罗安息香", "white pepper": "白胡椒",
    "violet root": "紫罗兰根", "seaweed": "海藻", "green accord": "绿意香调", "marjoram": "马郁兰",
    "hazelnut": "榛子", "civetta": "灵猫香", "white tea": "白茶", "white honey": "白蜂蜜",
    "fennel": "茴香", "red currant": "红醋栗", "paprika": "红椒", "almond milk": "杏仁奶",
    "lime (linden) blossom": "椴树花", "salt": "盐", "pistachio": "开心果", "gurjan balsam": "古芸香脂",
    "pine tree needles": "松针", "amyl salicylate": "水杨酸戊酯", "indonesian patchouli leaf": "印度尼西亚广藿香叶",
    "broom": "金雀花", "green mandarin orange": "青橘", "red thyme": "红百里香",
    "lily of the valley": "铃兰", "celery seeds": "芹菜籽", "black amber": "黑琥珀",
    "white wood": "白木", "kumquat": "金橘", "animal notes": "动物感香气", "tobacco blossom": "烟草花",
    "blood mandarin": "血橘", "hinoki wood": "桧木", "olive tree": "橄榄木", "fir resin": "冷杉树脂",
    "lemongrass": "柠檬草", "mahogany": "桃花心木", "rose oil": "玫瑰精油", "sour cherry": "酸樱桃",
    "mignonette": "木犀草", "shiso": "紫苏", "cacao pod": "可可荚", "teak wood": "柚木",
    "cognac": "干邑", "fern": "蕨类", "exotic woods": "异域木材", "italian bergamot": "意大利佛手柑",
    "juniper berry": "杜松子", "dark chocolate": "黑巧克力", "quince": "榅桲", "cotton flower": "棉花",
    "wild berries": "野生浆果", "woods": "木质香", "sugar cane": "甘蔗", "vanilla absolute": "香草原精",
    "asafoetida": "阿魏", "jasmine absolute": "茉莉原精", "champagne": "香槟", "sweet pea": "香豌豆",
    "bitter almond": "苦杏仁", "coconut milk": "椰奶", "davana": "印蒿", "chestnut": "栗子",
    "dates": "椰枣", "taif rose": "塔伊夫玫瑰",
    "yellow mandarin": "黄橘", "camelia": "山茶花", "vervain": "马鞭草", "green almond": "青杏仁",
    "fig nectar": "无花果蜜", "fig tree": "无花果树", "ambrox": "龙涎香基调", "birch leaf": "桦树叶",
    "oregano": "牛至", "apple blossom": "苹果花", "white cedar extract": "白雪松提取物",
    "natural musk": "天然麝香", "sicilian bergamot": "西西里佛手柑", "texas cedar": "德州雪松",
    "ebony": "乌木", "cranberry": "蔓越莓", "nectarine": "油桃", "wisteria": "紫藤",
    "flax": "亚麻", "black locust": "刺槐花", "rose absolute": "玫瑰原精", "sicilian orange": "西西里橙",
    "passion flower": "西番莲花", "rose petals": "玫瑰花瓣", "cannabis": "大麻叶",
    "turkey red rose": "土耳其红玫瑰", "australian sandalwood": "澳大利亚檀香",
    "cashmirwood": "羊绒木", "linen": "亚麻布",
}

FAMILY_ZH = {
    "amber-floral": "琥珀花香调", "amber-woody": "琥珀木质调", "aromatic-aquatic": "芳香水生调",
    "aromatic-fougere": "芳香馥奇调", "chypre-floral": "西普花香调", "chypre-fruity": "西普果香调",
    "citrus-aromatic": "柑橘芳香调", "floral": "花香调", "floral-fruity": "花果香调",
    "floral-woody": "花香木质调", "fresh-citrusy": "清新柑橘调", "green-floral": "绿意花香调",
    "leathery": "皮革调", "oriental-floral": "东方花香调", "oriental-spicy": "东方辛香调",
    "spicy-woody": "辛香木质调", "woody": "木质调", "woody-aromatic": "木质芳香调",
    "woody-spicy": "木质辛香调",
}


def archive_value(record: dict, current: str, legacy: str):
    return record.get(current, record.get(legacy))


def words(value: object) -> list[str]:
    text = unicodedata.normalize("NFKD", str(value or "")).casefold()
    text = "".join(char for char in text if not unicodedata.combining(char))
    text = text.replace("&", " and ")
    return re.findall(r"[a-z0-9]+", text)


def normalized(value: object) -> str:
    return "".join(words(value))


def core_words(value: object) -> list[str]:
    return [word for word in words(value) if word not in GENERIC_WORDS and len(word) > 1]


def parse_year(value: object) -> int | None:
    try:
        if value in (None, "", "NA", "N/A"):
            return None
        result = int(float(str(value)))
        return result if 1500 <= result <= 2100 else None
    except (TypeError, ValueError):
        return None


def clean_field(value: object) -> str | None:
    value = html.unescape(str(value or "")).strip()
    return None if not value or value.upper() in {"NA", "N/A", "UNKNOWN"} else value


def split_field(value: object) -> list[str]:
    cleaned = clean_field(value)
    if not cleaned:
        return []
    return [item.strip() for item in re.split(r"\s*,\s*|\s*/\s*", cleaned) if item.strip()]


def concentration_from(value: object) -> str | None:
    token_list = words(value)
    for label, token_pattern in CONCENTRATIONS:
        length = len(token_pattern)
        for index in range(len(token_list) - length + 1):
            if tuple(token_list[index:index + length]) == token_pattern:
                return label
    return None


def canonical_concentration(value: object) -> str | None:
    direct = clean_field(value)
    if not direct:
        return None
    found = concentration_from(direct)
    return found or direct


def strip_parfumo_noise(name: str, brand: str, year: int | None, concentration: str | None) -> str:
    name_tokens = words(name)
    brand_tokens = words(brand)
    suffixes = [list(tokens) for _, tokens in CONCENTRATIONS]
    changed = True
    while changed and name_tokens:
        changed = False
        for suffix in suffixes:
            if len(name_tokens) >= len(suffix) and name_tokens[-len(suffix):] == suffix:
                name_tokens = name_tokens[:-len(suffix)]
                changed = True
                break
        if year and name_tokens[-1:] == [str(year)]:
            name_tokens = name_tokens[:-1]
            changed = True
        if brand_tokens and len(name_tokens) >= len(brand_tokens) and name_tokens[-len(brand_tokens):] == brand_tokens:
            name_tokens = name_tokens[:-len(brand_tokens)]
            changed = True
    return " ".join(name_tokens)


def strip_fragrantica_duplicate_brand(name: str, brand: str) -> str:
    name_tokens = words(name)
    brand_tokens = words(brand)
    while brand_tokens and len(name_tokens) >= len(brand_tokens) and name_tokens[:len(brand_tokens)] == brand_tokens:
        name_tokens = name_tokens[len(brand_tokens):]
    return " ".join(name_tokens)


def download(url: str, destination: Path, attempts: int = 3, timeout: int = 30) -> Path:
    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.exists() and destination.stat().st_size > 0:
        return destination
    headers = {
        "User-Agent": "Mozilla/5.0 (compatible; PersonalScentArchive/1.0; research prototype)",
        "Accept-Language": "en-US,en;q=0.8",
    }
    error = None
    for attempt in range(attempts):
        try:
            request = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(request, timeout=timeout) as response:
                payload = response.read()
            if not payload:
                raise OSError("empty response")
            temporary = destination.with_suffix(destination.suffix + ".part")
            temporary.write_bytes(payload)
            temporary.replace(destination)
            return destination
        except Exception as exc:  # network errors vary by platform
            error = exc
            if attempt + 1 < attempts:
                time.sleep(0.4 * (attempt + 1))
    raise OSError(f"download failed for {url}: {error}")


def ensure_sources() -> None:
    CACHE.mkdir(parents=True, exist_ok=True)
    if not PARFUMO_CSV.exists():
        print("Downloading Parfumo research dataset…", flush=True)
        download(PARFUMO_DATA_URL, PARFUMO_CSV, timeout=90)
    if not FRAGRANTICA_CSV.exists():
        if not FRAGRANTICA_ZIP.exists():
            print("Downloading Fragrantica research dataset…", flush=True)
            download(FRAGRANTICA_DATA_URL, FRAGRANTICA_ZIP, timeout=120)
        FRAGRANTICA_CSV.parent.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(FRAGRANTICA_ZIP) as archive:
            archive.extract("fra_cleaned.csv", FRAGRANTICA_CSV.parent)


@dataclass
class SourceRecord:
    source: str
    brand: str
    name: str
    clean_name: str
    year: int | None
    concentration: str | None
    url: str
    row: dict
    full_key: str
    clean_key: str
    tokens: list[str]
    brand_tokens: set[str]
    name_tokens: set[str]


@dataclass
class Match:
    record: SourceRecord | None = None
    confidence: str = "unmatched"
    score: float = 0.0
    conflict: str | None = None
    candidates: list[dict] = field(default_factory=list)


class Matcher:
    def __init__(self, source: str, records: list[SourceRecord]):
        self.source = source
        self.records = records
        self.key_index: dict[str, list[int]] = defaultdict(list)
        self.token_index: dict[str, set[int]] = defaultdict(set)
        for index, record in enumerate(records):
            self.key_index[record.full_key].append(index)
            self.key_index[record.clean_key].append(index)
            for token in set(record.tokens):
                if len(token) >= 3:
                    self.token_index[token].add(index)

    def _compatible(self, target: dict, candidate: SourceRecord) -> tuple[bool, str | None]:
        target_name = archive_value(target, "nameEnglish", "nameEn")
        target_concentration = concentration_from(target_name)
        target_year = archive_value(target, "releaseYear", "year")
        if target_concentration and candidate.concentration:
            if normalized(target_concentration) != normalized(candidate.concentration):
                return False, "浓度版本冲突"
        if target_year and candidate.year and target_year != candidate.year:
            return False, "发行年份冲突"
        return True, None

    def _select_exact(self, target: dict, candidate_ids: Iterable[int]) -> Match:
        target_name = archive_value(target, "nameEnglish", "nameEn")
        target_key = normalized(target_name)
        target_year = archive_value(target, "releaseYear", "year")
        target_concentration = concentration_from(target_name)
        candidates = list({self.records[index].url: self.records[index] for index in candidate_ids}.values())

        if target_concentration:
            same_concentration = [
                record for record in candidates
                if record.concentration and normalized(record.concentration) == normalized(target_concentration)
            ]
            if same_concentration:
                candidates = same_concentration

        if target_year:
            same_year = [record for record in candidates if record.year == target_year]
            if same_year:
                candidates = same_year
            else:
                unknown_year = [record for record in candidates if record.year is None]
                if unknown_year:
                    candidates = unknown_year
                elif any(record.year for record in candidates):
                    return Match(
                        conflict="发行年份冲突",
                        candidates=self._candidate_summary(candidates),
                    )

        raw_exact = [record for record in candidates if record.full_key == target_key]
        if len(raw_exact) == 1:
            candidates = raw_exact
        elif len(candidates) > 1:
            # Identical names can legitimately have multiple concentrations or relaunches.
            return Match(
                conflict="同名版本无法唯一确认",
                candidates=self._candidate_summary(candidates),
            )

        if not candidates:
            return Match()
        record = candidates[0]
        compatible, reason = self._compatible(target, record)
        if not compatible:
            return Match(conflict=reason, candidates=self._candidate_summary([record]))
        if target_year and record.year == target_year:
            confidence = "exact-year"
        elif target_year and record.year is None:
            confidence = "exact-name-year-unavailable"
        else:
            confidence = "exact-name"
        return Match(record=record, confidence=confidence, score=1.0)

    @staticmethod
    def _candidate_summary(candidates: Iterable[SourceRecord]) -> list[dict]:
        return [
            {
                "brand": record.brand,
                "name": record.name,
                "year": record.year,
                "concentration": record.concentration,
                "url": record.url,
            }
            for record in list(candidates)[:5]
        ]

    def match(self, target: dict) -> Match:
        target_name = archive_value(target, "nameEnglish", "nameEn")
        target_key = normalized(target_name)
        exact_ids = self.key_index.get(target_key, [])
        if exact_ids:
            exact = self._select_exact(target, exact_ids)
            if exact.record or exact.conflict:
                return exact

        target_tokens = core_words(target_name)
        target_set = set(target_tokens)
        vote_counter: Counter[int] = Counter()
        for token in target_set:
            if len(token) >= 3:
                for index in self.token_index.get(token, ()):
                    vote_counter[index] += 1
        minimum_overlap = 2 if len(target_set) >= 3 else 1
        candidate_ids = [index for index, overlap in vote_counter.most_common(650) if overlap >= minimum_overlap]
        scored: list[tuple[float, SourceRecord, float, float]] = []
        target_first = set(target_tokens[:6])
        target_year = archive_value(target, "releaseYear", "year")
        target_concentration = concentration_from(target_name)

        for index in candidate_ids:
            candidate = self.records[index]
            brand_overlap = len(candidate.brand_tokens & target_first) / max(1, len(candidate.brand_tokens))
            if brand_overlap == 0:
                continue
            if target_year and candidate.year and target_year != candidate.year:
                continue
            if target_concentration and candidate.concentration:
                if normalized(target_concentration) != normalized(candidate.concentration):
                    continue

            candidate_set = set(candidate.tokens)
            overlap = len(target_set & candidate_set)
            token_f1 = 2 * overlap / max(1, len(target_set) + len(candidate_set))
            target_product = [token for token in target_tokens if token not in candidate.brand_tokens]
            product_f1 = 2 * len(set(target_product) & candidate.name_tokens) / max(
                1, len(set(target_product)) + len(candidate.name_tokens)
            )
            sequence = difflib.SequenceMatcher(
                None, "".join(target_product), "".join(sorted(candidate.name_tokens)), autojunk=False
            ).ratio()
            year_bonus = 0.08 if target_year and candidate.year == target_year else 0.0
            score = 0.30 * token_f1 + 0.38 * product_f1 + 0.18 * sequence + 0.06 * brand_overlap + year_bonus
            scored.append((score, candidate, product_f1, brand_overlap))

        scored.sort(key=lambda item: item[0], reverse=True)
        if not scored:
            return Match()
        best_score, best, product_f1, brand_overlap = scored[0]
        second_score = scored[1][0] if len(scored) > 1 else 0.0
        exact_year = bool(target_year and best.year == target_year)
        accepted = (
            best_score >= 0.89 and second_score <= best_score - 0.045
        ) or (
            exact_year and product_f1 >= 0.86 and brand_overlap >= 0.45
            and best_score >= 0.79 and second_score <= best_score - 0.035
        )
        if not accepted:
            return Match(
                conflict="模糊匹配置信度不足",
                score=best_score,
                candidates=self._candidate_summary(item[1] for item in scored[:5]),
            )
        return Match(
            record=best,
            confidence="fuzzy-year" if exact_year else "fuzzy-name",
            score=best_score,
            candidates=self._candidate_summary([best]),
        )


def read_sources() -> tuple[list[SourceRecord], list[SourceRecord]]:
    parfumo: list[SourceRecord] = []
    with PARFUMO_CSV.open(encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle):
            brand = row["Brand"]
            name = row["Name"]
            year = parse_year(row["Release_Year"])
            concentration = canonical_concentration(row["Concentration"])
            clean_name = strip_parfumo_noise(name, brand, year, concentration)
            parfumo.append(SourceRecord(
                source="Parfumo",
                brand=brand,
                name=name,
                clean_name=clean_name,
                year=year,
                concentration=concentration,
                url=row["URL"],
                row=row,
                full_key=normalized(f"{brand} {name}"),
                clean_key=normalized(f"{brand} {clean_name}"),
                tokens=core_words(f"{brand} {clean_name}"),
                brand_tokens=set(core_words(brand)),
                name_tokens=set(core_words(clean_name)),
            ))

    fragrantica: list[SourceRecord] = []
    with FRAGRANTICA_CSV.open(encoding="latin-1", newline="") as handle:
        for row in csv.DictReader(handle, delimiter=";"):
            brand = row["Brand"]
            name = row["Perfume"]
            clean_name = strip_fragrantica_duplicate_brand(name, brand)
            fragrantica.append(SourceRecord(
                source="Fragrantica",
                brand=brand,
                name=name,
                clean_name=clean_name,
                year=parse_year(row["Year"]),
                concentration=concentration_from(name),
                url=row["url"],
                row=row,
                full_key=normalized(f"{brand} {name}"),
                clean_key=normalized(f"{brand} {clean_name}"),
                tokens=core_words(f"{brand} {clean_name}"),
                brand_tokens=set(core_words(brand)),
                name_tokens=set(core_words(clean_name)),
            ))
    return parfumo, fragrantica


def strip_tags(value: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", value))).strip()


def parse_parfumo_page(page: str) -> dict:
    result: dict = {}
    canonical_match = re.search(r'<meta\s+itemprop="url"\s+content="([^"]+)"', page, re.I)
    if canonical_match:
        result["canonicalUrl"] = html.unescape(canonical_match.group(1)).strip()
    image_match = re.search(r'<img\s+src="([^"]+)"[^>]*class="p-main-img"', page, re.I)
    if image_match:
        result["imageUrl"] = html.unescape(image_match.group(1))

    title_match = re.search(r'<h1[^>]*class="p_name_h1"[^>]*>(.*?)</h1>', page, re.I | re.S)
    if title_match:
        result["pageTitle"] = strip_tags(title_match.group(1))
        year_match = re.search(r'class="label_a"[^>]*>(\d{4})</span>', title_match.group(1))
        result["year"] = parse_year(year_match.group(1)) if year_match else None

    description_match = re.search(r'<meta\s+property="og:description"\s+content="([^"]*)"', page, re.I)
    source_description = html.unescape(description_match.group(1)) if description_match else ""
    family_match = re.search(r"The scent is ([^.]+)\.", source_description, re.I)
    if family_match:
        result["fragranceFamily"] = family_match.group(1).strip()
    if re.search(r"production was apparently discontinued|is no longer in production", source_description, re.I):
        result["specialStatus"] = "资料显示可能已停产"

    accord_segment = re.search(r">Main accords</h2>(.*?)Fragrance Pyramid</h2>", page, re.I | re.S)
    if accord_segment:
        result["mainAccords"] = [
            strip_tags(value)
            for value in re.findall(r'<div class="text-xs grey">(.*?)</div>', accord_segment.group(1), re.I | re.S)
            if strip_tags(value)
        ]

    notes: dict[str, list[str]] = {"t": [], "m": [], "b": []}
    for note_type, note in re.findall(
        r'data-nt="([tmb])"[^>]*>.*?<img[^>]+alt="([^"]+)"', page, re.I | re.S
    ):
        note = html.unescape(note).strip()
        if note and note not in notes[note_type]:
            notes[note_type].append(note)
    result["topNotes"] = notes["t"]
    result["middleNotes"] = notes["m"]
    result["baseNotes"] = notes["b"]

    perfumer_segment = re.search(
        r'<h2[^>]*>\s*Perfumer\s*</h2>\s*<div[^>]*>(.*?)</div>', page, re.I | re.S
    )
    if perfumer_segment:
        names = [strip_tags(value) for value in re.findall(r'<a[^>]*>(.*?)</a>', perfumer_segment.group(1), re.I | re.S)]
        result["perfumer"] = [name for name in names if name]

    collection_match = re.search(
        r'<div class="text-sm grey upper[^>]*><a[^>]*>(.*?)</a></div><h1', page, re.I | re.S
    )
    if collection_match:
        collection = strip_tags(collection_match.group(1))
        if collection and collection.casefold() != "main":
            result["series"] = collection
    return result


def page_matches_source(details: dict, source: SourceRecord) -> bool:
    """Reject Parfumo responses whose body belongs to a different perfume.

    Parfumo may redirect an old slug to a shorter canonical slug, so equality of
    URLs is too strict. The canonical product slug must nevertheless be composed
    from the selected source record's product-name tokens.
    """
    canonical = details.get("canonicalUrl")
    if not canonical:
        return False
    canonical_slug = canonical.rstrip("/").split("/")[-1]
    canonical_tokens = set(core_words(canonical_slug))
    source_tokens = set(core_words(source.clean_name))
    if not canonical_tokens or not source_tokens:
        return False
    overlap = len(canonical_tokens & source_tokens)
    containment = overlap / max(1, min(len(canonical_tokens), len(source_tokens)))
    return overlap >= 1 and containment >= 0.66


def page_for(record_id: str, match: Match) -> tuple[str, dict | None, str | None]:
    assert match.record
    target = PAGE_CACHE / f"{record_id}.html"
    try:
        download(match.record.url, target, attempts=2, timeout=35)
        page = target.read_text(encoding="utf-8", errors="replace")
        if "p-main-img" not in page or len(page) < 20_000:
            raise OSError("page did not contain perfume details")
        details = parse_parfumo_page(page)
        if not page_matches_source(details, match.record):
            raise OSError("Parfumo response body did not match the requested perfume")
        return record_id, details, None
    except Exception as exc:
        return record_id, None, str(exc)


def fetch_pages(records: list[dict], matches: dict[str, Match], workers: int) -> tuple[dict[str, dict], dict[str, str]]:
    PAGE_CACHE.mkdir(parents=True, exist_ok=True)
    parsed: dict[str, dict] = {}
    errors: dict[str, str] = {}
    jobs = [(record["id"], matches[record["id"]]) for record in records if matches[record["id"]].record]
    print(f"Fetching {len(jobs)} matched Parfumo pages…", flush=True)
    with ThreadPoolExecutor(max_workers=workers) as executor:
        futures = [executor.submit(page_for, record_id, match) for record_id, match in jobs]
        for completed, future in enumerate(as_completed(futures), start=1):
            record_id, details, error = future.result()
            if details:
                parsed[record_id] = details
            else:
                errors[record_id] = error or "unknown error"
            if completed % 100 == 0 or completed == len(futures):
                print(f"  pages {completed}/{len(futures)}; ok={len(parsed)} failed={len(errors)}", flush=True)
    return parsed, errors


def note_zh(value: str) -> str:
    key = value.strip().casefold()
    if key in NOTE_ZH:
        return NOTE_ZH[key]
    key = re.sub(r"^(madagascan|bulgarian|egyptian|indian|tahitian|virginia)\s+", "", key)
    if key in NOTE_ZH:
        return NOTE_ZH[key]
    return value.strip()


def accord_zh(value: str) -> str:
    return ACCORD_ZH.get(value.strip().casefold(), value.strip())


def perfumer_name(value: str) -> str:
    value = value.strip()
    return value.title() if value.islower() else value


def family_zh(value: str | None) -> str | None:
    if not value:
        return None
    key = re.sub(r"\s+", "-", value.strip().casefold())
    if key in FAMILY_ZH:
        return FAMILY_ZH[key]
    pieces = [ACCORD_ZH.get(piece, piece) for piece in key.split("-")]
    translated = "·".join(pieces)
    return translated + ("调" if all(re.search(r"[\u4e00-\u9fff]", piece) for piece in pieces) else "")


def phrase(items: list[str], count: int = 3) -> str:
    return "、".join(note_zh(item) for item in items[:count])


def make_description(record_id: str, family: str | None, accords: list[str], top: list[str], middle: list[str], base: list[str]) -> str | None:
    if not any((family, accords, top, middle, base)):
        return None
    family_text = family or ("、".join(accord_zh(item) for item in accords[:2]) + "气味")
    accord_text = "、".join(accord_zh(item) for item in accords[:4])
    variants = int(record_id[1:]) % 6
    if top and middle and base:
        openings = [
            f"资料将它归入{family_text}。开场以{phrase(top)}展开，",
            f"这款香水的结构以{family_text}为主。起始的{phrase(top)}之后，",
            f"从香调表来看，它是一款{family_text}作品：前调先出现{phrase(top)}，",
            f"它以{phrase(top)}作为开场，并把整体气味放在{family_text}的框架中；",
            f"气味从{phrase(top)}起步，整体方向属于{family_text}。随后，",
            f"这是一款资料标注为{family_text}的香水。最先能辨认的是{phrase(top)}，",
        ]
        middles = [
            f"中段转向{phrase(middle)}，最后由{phrase(base)}收束。",
            f"香气逐渐进入以{phrase(middle)}为中心的中段，尾声落在{phrase(base)}。",
            f"之后{phrase(middle)}成为主体，干燥下来则留下{phrase(base)}。",
            f"核心由{phrase(middle)}承接，后调以{phrase(base)}拉长气味轮廓。",
            f"中调的{phrase(middle)}接过重心，最终沉入{phrase(base)}。",
            f"发展到中段可见{phrase(middle)}，收尾则以{phrase(base)}为主。",
        ]
        text = openings[variants] + middles[variants]
    elif accords:
        text = (
            f"现有资料把它描述为{family_text}，主要气味集中在{accord_text}。"
            f"资料没有给出完整的前、中、后调分层，因此这里不推测具体演变；"
            f"可以确认的是，整体辨识度主要来自这些气味方向之间的组合。"
        )
    elif any((top, middle, base)):
        layers = [phrase(items) for items in (top, middle, base) if items]
        text = (
            f"现有香调资料记录了{'，随后是'.join(layers)}。"
            "由于资料未提供完整的气味分类与全部层次，这里只保留能够核实的结构，"
            "不额外推断季节、场景或未列出的香材。"
        )
    else:
        text = (
            f"现有可靠资料将这款香水归入{family_text}，但没有同时提供可核对的前调、中调与后调。"
            "因此档案只保留已经确认的气味类型，不根据名称或瓶身推测具体香材，也不自动补写季节、场景与气味演变。"
        )
    if accord_text and top and middle and base:
        text += f"主要气味被概括为{accord_text}，整体变化可从这些香材的先后关系中理解。"
    if len(text) < 80:
        text += "这段说明只依据能够追溯的香调与气味资料整理，未加入未经来源支持的场景或感受。"
    return text[:180]


def fragrantica_fields(match: Match) -> dict:
    if not match.record:
        return {}
    row = match.record.row
    accords = [row.get(f"mainaccord{index}", "") for index in range(1, 6)]
    return {
        "topNotes": split_field(row.get("Top")),
        "middleNotes": split_field(row.get("Middle")),
        "baseNotes": split_field(row.get("Base")),
        "mainAccords": [clean_field(value) for value in accords if clean_field(value)],
        "perfumer": [
            value for value in [clean_field(row.get("Perfumer1")), clean_field(row.get("Perfumer2"))] if value
        ],
    }


def parfumo_csv_fields(match: Match) -> dict:
    if not match.record:
        return {}
    row = match.record.row
    return {
        "topNotes": split_field(row.get("Top_Notes")),
        "middleNotes": split_field(row.get("Middle_Notes")),
        "baseNotes": split_field(row.get("Base_Notes")),
        "mainAccords": split_field(row.get("Main_Accords")),
        "perfumer": split_field(row.get("Perfumers")),
    }


def source_link(label: str, url: str, source_type: str) -> dict:
    return {"label": label, "url": url, "type": source_type}


def choose_fields(page: dict | None, parfumo: Match, fragrantica: Match) -> dict:
    p_fields = parfumo_csv_fields(parfumo)
    f_fields = fragrantica_fields(fragrantica)
    result = {}
    for key in ("topNotes", "middleNotes", "baseNotes", "mainAccords", "perfumer"):
        page_value = (page or {}).get(key) or []
        result[key] = page_value or f_fields.get(key) or p_fields.get(key) or []
    result["fragranceFamily"] = family_zh((page or {}).get("fragranceFamily"))
    return result


def image_candidate(record: dict, parfumo: Match, fragrantica: Match, page: dict | None) -> tuple[str | None, str | None, str | None]:
    original_year = archive_value(record, "releaseYear", "year")
    if parfumo.record and page and page.get("imageUrl"):
        page_year = page.get("year")
        if not original_year or not page_year or original_year == page_year:
            return page["imageUrl"], parfumo.record.url, "Parfumo"
    if fragrantica.record:
        match = re.search(r"-(\d+)\.html(?:$|\?)", fragrantica.record.url)
        if match:
            image_url = f"https://fimgs.net/mdimg/perfume/375x500.{match.group(1)}.jpg"
            return image_url, fragrantica.record.url, "Fragrantica"
    return None, None, None


def fetch_image_job(job: tuple[dict, Match, Match, dict | None]) -> tuple[str, dict]:
    record, parfumo, fragrantica, page = job
    record_id = record["id"]
    url, source_url, provider = image_candidate(record, parfumo, fragrantica, page)
    if not url:
        return record_id, {"status": "pending", "reason": "没有可唯一确认的网络图片"}
    source_extension = ".jpg"
    cached = DOWNLOAD_CACHE / f"{record_id}{source_extension}"
    try:
        download(url, cached, attempts=2, timeout=40)
        with Image.open(cached) as source:
            source.load()
            width, height = source.size
            if width < 240 or height < 240:
                raise OSError(f"source image too small: {width}x{height}")
            source = ImageOps.exif_transpose(source).convert("RGB")
            LARGE_DIR.mkdir(parents=True, exist_ok=True)
            THUMB_DIR.mkdir(parents=True, exist_ok=True)
            large = source.copy()
            large.thumbnail((900, 900), Image.Resampling.LANCZOS)
            large.save(LARGE_DIR / f"{record_id}.webp", "WEBP", quality=76, method=6)
            thumb = source.copy()
            thumb.thumbnail((360, 360), Image.Resampling.LANCZOS)
            thumb.save(THUMB_DIR / f"{record_id}.webp", "WEBP", quality=72, method=6)
            return record_id, {
                "status": "verified" if provider == "Parfumo" and width >= 600 else "partial",
                "provider": provider,
                "sourceUrl": source_url,
                "assetUrl": url,
                "width": width,
                "height": height,
                "large": f"/large/{record_id}.webp",
                "thumbnail": f"/thumbnails/{record_id}.webp",
            }
    except Exception as exc:
        return record_id, {"status": "pending", "reason": str(exc), "sourceUrl": source_url}


def fetch_images(records: list[dict], p_matches: dict[str, Match], f_matches: dict[str, Match], pages: dict[str, dict], workers: int) -> dict[str, dict]:
    DOWNLOAD_CACHE.mkdir(parents=True, exist_ok=True)
    jobs = [(record, p_matches[record["id"]], f_matches[record["id"]], pages.get(record["id"])) for record in records]
    results: dict[str, dict] = {}
    print(f"Downloading and converting up to {len(jobs)} local images…", flush=True)
    with ThreadPoolExecutor(max_workers=workers) as executor:
        futures = [executor.submit(fetch_image_job, job) for job in jobs]
        for completed, future in enumerate(as_completed(futures), start=1):
            record_id, result = future.result()
            results[record_id] = result
            if completed % 100 == 0 or completed == len(futures):
                verified = sum(item["status"] == "verified" for item in results.values())
                partial = sum(item["status"] == "partial" for item in results.values())
                print(f"  images {completed}/{len(futures)}; verified={verified} partial={partial}", flush=True)
    return results


def duplicate_audit(records: list[dict]) -> list[dict]:
    groups: dict[tuple[str, int | None], list[dict]] = defaultdict(list)
    for record in records:
        name = archive_value(record, "nameEnglish", "nameEn")
        year = archive_value(record, "releaseYear", "year")
        groups[(normalized(name), year)].append(record)
    duplicates = []
    for group in groups.values():
        if len(group) < 2:
            continue
        chinese_names = {archive_value(record, "nameChinese", "nameZh") for record in group}
        # A missing English product name alone is not evidence that two Chinese products are duplicates.
        if len(chinese_names) > 1 and all(len(words(archive_value(record, "nameEnglish", "nameEn"))) <= 1 for record in group):
            continue
        duplicates.append({
            "identity": archive_value(group[0], "nameEnglish", "nameEn"),
            "year": archive_value(group[0], "releaseYear", "year"),
            "records": [
                {
                    "id": record["id"],
                    "nameChinese": archive_value(record, "nameChinese", "nameZh"),
                    "personalRating": archive_value(record, "personalRating", "rating"),
                }
                for record in group
            ],
        })
    return duplicates


def build_archive(records: list[dict], p_matches: dict[str, Match], f_matches: dict[str, Match], pages: dict[str, dict], images: dict[str, dict]) -> tuple[list[dict], dict]:
    enriched = []
    review_records = []
    match_conflicts = 0
    low_confidence_candidates = 0
    descriptions = 0
    complete_pyramids = 0
    verified_information = 0
    partial_information = 0

    for record in records:
        record_id = record["id"]
        p_match = p_matches[record_id]
        f_match = f_matches[record_id]
        page = pages.get(record_id)
        image = images.get(record_id, {"status": "pending", "reason": "图片抓取未执行"})
        fields = choose_fields(page, p_match, f_match)
        original_year = archive_value(record, "releaseYear", "year")
        page_year = (page or {}).get("year")
        page_year_conflict = bool(original_year and page_year and original_year != page_year)
        all_match_notes = [value for value in (p_match.conflict, f_match.conflict) if value]
        conflicts = [value for value in all_match_notes if value != "模糊匹配置信度不足"]
        review_notes = list(all_match_notes)
        if any(value == "模糊匹配置信度不足" for value in all_match_notes):
            low_confidence_candidates += 1
        if page_year_conflict:
            conflicts.append("Parfumo 当前页面年份与原档案冲突")
            review_notes.append("Parfumo 当前页面年份与原档案冲突")
        if conflicts:
            match_conflicts += 1

        information_sources = []
        if p_match.record:
            information_sources.append(source_link("Parfumo 档案", p_match.record.url, "information"))
        if f_match.record:
            information_sources.append(source_link("Fragrantica 档案", f_match.record.url, "information"))
        if p_match.record:
            information_sources.append(source_link("Parfumo 结构化数据说明", PARFUMO_DATASET_SOURCE, "dataset"))
        if f_match.record:
            information_sources.append(source_link("Fragrantica 结构化数据说明", FRAGRANTICA_DATASET_SOURCE, "dataset"))

        source_count = int(bool(p_match.record)) + int(bool(f_match.record))
        if source_count >= 2 and not page_year_conflict:
            verification_status = "verified"
            verified_information += 1
        elif source_count == 1 and not page_year_conflict:
            verification_status = "partial"
            partial_information += 1
        else:
            verification_status = "pending"

        concentration = None
        if p_match.record:
            concentration = p_match.record.concentration
        if not concentration:
            concentration = concentration_from(archive_value(record, "nameEnglish", "nameEn"))

        description = make_description(
            record_id,
            fields["fragranceFamily"],
            fields["mainAccords"],
            fields["topNotes"],
            fields["middleNotes"],
            fields["baseNotes"],
        )
        if description:
            descriptions += 1
        if fields["topNotes"] and fields["middleNotes"] and fields["baseNotes"]:
            complete_pyramids += 1

        original_image = record.get("originalImage", record.get("image", f"/perfumes/{record_id}.png"))
        image_thumbnail = image.get("thumbnail", f"/thumbnails/{record_id}.webp")
        image_large = image.get("large", "/images/image-pending.svg")
        image_source = None
        if image.get("sourceUrl"):
            image_source = {
                "label": f"{image.get('provider', '网络资料')} 图片来源",
                "url": image["sourceUrl"],
            }

        item = {
            "id": record_id,
            "brand": record["brand"],
            "brandSlug": record["brandSlug"],
            "nameChinese": archive_value(record, "nameChinese", "nameZh"),
            "nameEnglish": archive_value(record, "nameEnglish", "nameEn"),
            "releaseYear": original_year,
            "personalRating": archive_value(record, "personalRating", "rating"),
            "concentration": concentration,
            "fragranceFamily": fields["fragranceFamily"],
            "topNotes": [note_zh(value) for value in fields["topNotes"]],
            "middleNotes": [note_zh(value) for value in fields["middleNotes"]],
            "baseNotes": [note_zh(value) for value in fields["baseNotes"]],
            "mainAccords": [accord_zh(value) for value in fields["mainAccords"]],
            "perfumer": [perfumer_name(value) for value in fields["perfumer"]],
            "description": description,
            "seasons": [],
            "timeOfDay": [],
            "occasions": [],
            "series": (page or {}).get("series"),
            "specialStatus": (page or {}).get("specialStatus"),
            "imageThumbnail": image_thumbnail,
            "imageLarge": image_large,
            "imageSource": image_source,
            "informationSources": information_sources,
            "verificationStatus": verification_status,
            "imageVerificationStatus": image.get("status", "pending"),
            "imageDimensions": {
                "width": image.get("width"),
                "height": image.get("height"),
            } if image.get("width") else None,
            "originalImage": original_image,
            "verificationNotes": list(dict.fromkeys(review_notes + ([image.get("reason")] if image.get("reason") else []))),
        }
        enriched.append(item)
        if verification_status != "verified" or image.get("status") != "verified":
            review_records.append({
                "id": record_id,
                "brand": item["brand"],
                "nameChinese": item["nameChinese"],
                "nameEnglish": item["nameEnglish"],
                "releaseYear": item["releaseYear"],
                "informationStatus": verification_status,
                "imageStatus": image.get("status", "pending"),
                "notes": item["verificationNotes"],
                "parfumoCandidates": p_match.candidates,
                "fragranticaCandidates": f_match.candidates,
            })

    duplicates = duplicate_audit(records)
    image_verified = sum(record["imageVerificationStatus"] == "verified" for record in enriched)
    image_partial = sum(record["imageVerificationStatus"] == "partial" for record in enriched)
    image_pending = len(enriched) - image_verified - image_partial
    audit = {
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "recordCount": len(enriched),
        "counts": {
            "highResolutionImages": image_verified,
            "clearerImagesBelowPreferredWidth": image_partial,
            "originalImagesStillReferenced": sum(record["imageLarge"] == record["originalImage"] for record in enriched),
            "imagePending": image_pending,
            "descriptions": descriptions,
            "completeNotePyramids": complete_pyramids,
            "verifiedInformation": verified_information,
            "partialInformation": partial_information,
            "informationIncomplete": len(enriched) - verified_information,
            "duplicateGroups": len(duplicates),
            "duplicateRecords": sum(len(group["records"]) for group in duplicates),
            "imageMatchConflicts": match_conflicts,
            "lowConfidenceCandidateRecords": low_confidence_candidates,
        },
        "duplicates": duplicates,
        "reviewRecords": review_records,
        "sourcePolicy": {
            "personalRatings": "Only the uploaded archive is used; online ratings are ignored.",
            "matching": "Brand/name/year/concentration conflicts are never auto-resolved.",
            "copyright": "All externally sourced prototype images require rights confirmation before public release.",
        },
    }
    return enriched, audit


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--workers", type=int, default=8)
    parser.add_argument("--skip-pages", action="store_true")
    parser.add_argument("--skip-images", action="store_true")
    args = parser.parse_args()

    ensure_sources()
    records = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    parfumo_records, fragrantica_records = read_sources()
    print(f"Loaded {len(records)} archive records, {len(parfumo_records)} Parfumo rows, {len(fragrantica_records)} Fragrantica rows", flush=True)
    p_matcher = Matcher("Parfumo", parfumo_records)
    f_matcher = Matcher("Fragrantica", fragrantica_records)
    p_matches = {record["id"]: p_matcher.match(record) for record in records}
    f_matches = {record["id"]: f_matcher.match(record) for record in records}
    print(
        "Matches: "
        f"Parfumo={sum(bool(match.record) for match in p_matches.values())}, "
        f"Fragrantica={sum(bool(match.record) for match in f_matches.values())}, "
        f"cross-source={sum(bool(p_matches[r['id']].record and f_matches[r['id']].record) for r in records)}",
        flush=True,
    )

    pages = {}
    page_errors = {}
    if not args.skip_pages:
        pages, page_errors = fetch_pages(records, p_matches, args.workers)
    else:
        for record in records:
            cached = PAGE_CACHE / f"{record['id']}.html"
            if cached.exists():
                match = p_matches[record["id"]]
                if not match.record:
                    continue
                details = parse_parfumo_page(cached.read_text(encoding="utf-8", errors="replace"))
                if page_matches_source(details, match.record):
                    pages[record["id"]] = details

    images = {}
    if not args.skip_images:
        images = fetch_images(records, p_matches, f_matches, pages, args.workers)
    else:
        for record in records:
            record_id = record["id"]
            large = LARGE_DIR / f"{record_id}.webp"
            if large.exists():
                try:
                    with Image.open(large) as image:
                        width, height = image.size
                    images[record_id] = {
                        "status": "verified" if width >= 600 else "partial",
                        "width": width,
                        "height": height,
                        "large": f"/large/{record_id}.webp",
                        "thumbnail": f"/thumbnails/{record_id}.webp",
                    }
                except Exception:
                    pass

    enriched, audit = build_archive(records, p_matches, f_matches, pages, images)
    audit["pageFetchErrors"] = page_errors
    DATA_PATH.write_text(json.dumps(enriched, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    AUDIT_PATH.write_text(json.dumps(audit, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(audit["counts"], ensure_ascii=False, indent=2), flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
