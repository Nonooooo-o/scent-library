export function filterAndSortPerfumes(
  perfumes,
  {
    query = "",
    brand = "all",
    rating = "all",
    year = "all",
    fragranceFamily = "all",
    verification = "all",
    sort = "nameChinese",
  } = {}
) {
  const normalizedQuery = query.trim().normalize("NFKC").toLocaleLowerCase("zh-CN");
  const result = perfumes.filter((perfume) => {
    const matchesBrand = brand === "all" || perfume.brand === brand;
    const matchesRating = rating === "all" || perfume.personalRating === Number(rating);
    const matchesYear =
      year === "all" ||
      (year === "missing" ? perfume.releaseYear === null : perfume.releaseYear === Number(year));
    const matchesFamily =
      fragranceFamily === "all" ||
      (fragranceFamily === "missing"
        ? !perfume.fragranceFamily
        : perfume.fragranceFamily === fragranceFamily);
    const matchesVerification =
      verification === "all" ||
      (verification === "verified"
        ? perfume.verificationStatus === "verified" && perfume.imageVerificationStatus === "verified"
        : verification === "image-pending"
          ? perfume.imageVerificationStatus !== "verified"
          : perfume.verificationStatus !== "verified");
    const haystack = `${perfume.brand} ${perfume.nameChinese} ${perfume.nameEnglish}`
      .normalize("NFKC")
      .toLocaleLowerCase("zh-CN");
    return (
      matchesBrand &&
      matchesRating &&
      matchesYear &&
      matchesFamily &&
      matchesVerification &&
      (!normalizedQuery || haystack.includes(normalizedQuery))
    );
  });

  return result.sort((a, b) => {
    if (sort === "nameEnglish") {
      return a.nameEnglish.localeCompare(b.nameEnglish, "en") || a.id.localeCompare(b.id);
    }
    if (sort === "yearDesc") {
      return (b.releaseYear ?? -Infinity) - (a.releaseYear ?? -Infinity) || a.id.localeCompare(b.id);
    }
    if (sort === "yearAsc") {
      return (a.releaseYear ?? Infinity) - (b.releaseYear ?? Infinity) || a.id.localeCompare(b.id);
    }
    if (sort === "ratingDesc") return b.personalRating - a.personalRating || a.id.localeCompare(b.id);
    if (sort === "ratingAsc") return a.personalRating - b.personalRating || a.id.localeCompare(b.id);
    return a.nameChinese.localeCompare(b.nameChinese, "zh-CN") || a.id.localeCompare(b.id);
  });
}
