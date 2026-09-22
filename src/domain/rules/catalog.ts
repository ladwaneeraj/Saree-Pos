import type { Design } from "../types";

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/**
 * Similarity for "You may also like". Weights favour what shoppers compare first:
 * fabric, then collection and category, then a comparable price.
 */
export function similarityScore(base: Design, other: Design): number {
  if (base.id === other.id) return -1;
  let score = 0;
  if (base.fabricId === other.fabricId) score += 3;
  if (base.categoryId === other.categoryId) score += 2;
  const sharedCollections = other.collectionIds.filter((c) => base.collectionIds.includes(c)).length;
  score += Math.min(sharedCollections, 2) * 1.5;
  const ratio = other.price / Math.max(base.price, 1);
  if (ratio >= 0.75 && ratio <= 1.33) score += 2;
  else if (ratio >= 0.5 && ratio <= 2) score += 0.5;
  return score;
}

export function rankSimilar(base: Design, candidates: Design[], limit: number): Design[] {
  return candidates
    .map((d) => ({ d, s: similarityScore(base, d) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.d.price - b.d.price)
    .slice(0, limit)
    .map((x) => x.d);
}
