/**
 * Advanced fuzzy matching utilities for intelligent item suggestions
 */

export interface FuzzyMatchResult {
  item: string;
  score: number;
  matchedParts: string[];
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix: number[][] = [];

  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[len1][len2];
}

/**
 * Normalize Persian/Arabic text for better matching
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[\u200C\u200D]/g, '') // Remove zero-width characters
    .replace(/[یي]/g, 'ی') // Normalize ی
    .replace(/[کك]/g, 'ک') // Normalize ک
    .replace(/[ةه]/g, 'ه') // Normalize ه
    .replace(/\s+/g, ' '); // Normalize whitespace
}

/**
 * Check if query is a substring of the item
 */
function isSubstringMatch(query: string, item: string): boolean {
  const normalizedQuery = normalizeText(query);
  const normalizedItem = normalizeText(item);
  return normalizedItem.includes(normalizedQuery);
}

/**
 * Check if query matches the beginning of the item
 */
function isPrefixMatch(query: string, item: string): boolean {
  const normalizedQuery = normalizeText(query);
  const normalizedItem = normalizeText(item);
  return normalizedItem.startsWith(normalizedQuery);
}

/**
 * Find matching parts between query and item
 */
function findMatchingParts(query: string, item: string): string[] {
  const normalizedQuery = normalizeText(query);
  const normalizedItem = normalizeText(item);
  const parts: string[] = [];
  const queryWords = normalizedQuery.split(/\s+/);

  queryWords.forEach(word => {
    if (normalizedItem.includes(word)) {
      parts.push(word);
    }
  });

  return parts;
}

/**
 * Calculate similarity score between query and item (0-1)
 */
export function calculateSimilarity(query: string, item: string): number {
  const normalizedQuery = normalizeText(query);
  const normalizedItem = normalizeText(item);

  // Exact match
  if (normalizedQuery === normalizedItem) return 1.0;

  // Prefix match gets high score
  if (isPrefixMatch(query, item)) {
    return 0.9 - (normalizedItem.length - normalizedQuery.length) * 0.01;
  }

  // Substring match
  if (isSubstringMatch(query, item)) {
    const distance = levenshteinDistance(normalizedQuery, normalizedItem);
    const maxLen = Math.max(normalizedQuery.length, normalizedItem.length);
    return 0.7 - (distance / maxLen) * 0.3;
  }

  // Fuzzy match using Levenshtein
  const distance = levenshteinDistance(normalizedQuery, normalizedItem);
  const maxLen = Math.max(normalizedQuery.length, normalizedItem.length);
  const similarity = 1 - (distance / maxLen);

  // Boost score if there are matching parts
  const matchingParts = findMatchingParts(query, item);
  if (matchingParts.length > 0) {
    return Math.min(1.0, similarity + matchingParts.length * 0.1);
  }

  return Math.max(0, similarity);
}

/**
 * Find best fuzzy matches for a query from a list of items
 */
export function findFuzzyMatches(
  query: string,
  items: string[],
  options: {
    minScore?: number;
    maxResults?: number;
    boostRecent?: boolean;
    recentItems?: Set<string>;
  } = {}
): FuzzyMatchResult[] {
  const {
    minScore = 0.3,
    maxResults = 10,
    boostRecent = false,
    recentItems = new Set(),
  } = options;

  if (!query || query.trim().length === 0) {
    return items.slice(0, maxResults).map(item => ({
      item,
      score: 1.0,
      matchedParts: [],
    }));
  }

  const results: FuzzyMatchResult[] = items.map(item => {
    let score = calculateSimilarity(query, item);

    // Boost score for recently used items
    if (boostRecent && recentItems.has(item)) {
      score = Math.min(1.0, score * 1.2);
    }

    return {
      item,
      score,
      matchedParts: findMatchingParts(query, item),
    };
  });

  return results
    .filter(result => result.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults);
}

/**
 * Smart item name normalization and matching
 */
export function smartItemMatch(
  query: string,
  candidate: string
): { match: boolean; confidence: number } {
  const similarity = calculateSimilarity(query, candidate);
  return {
    match: similarity >= 0.5,
    confidence: similarity,
  };
}
