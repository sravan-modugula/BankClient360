/**
 * Query strategy analyzer for adaptive search
 * Determines the best search approach based on query characteristics
 */

export type SearchMode = 'suppress' | 'prefix-only' | 'hybrid-low' | 'hybrid-standard';

export interface SearchStrategy {
  mode: SearchMode;
  fuzzyThreshold?: number;
  usePrefix: boolean;
  useFuzzy: boolean;
  description: string;
}

/**
 * Analyzes a search query and returns the optimal search strategy
 * 
 * Strategy matrix:
 * - ≤2 chars: Suppress (too short, avoid noise)
 * - 3-4 chars: Prefix only (instant feedback, no fuzzy overhead)
 * - 5-6 chars: Prefix + fuzzy with low threshold (0.2)
 * - ≥7 chars: Prefix + fuzzy with standard threshold (0.3)
 */
export function analyzeQuery(query: string): SearchStrategy {
  const trimmed = query.trim();
  const length = trimmed.length;

  if (length <= 2) {
    return {
      mode: 'suppress',
      usePrefix: false,
      useFuzzy: false,
      description: 'Query too short (≤2 chars)'
    };
  }

  if (length <= 4) {
    return {
      mode: 'prefix-only',
      usePrefix: true,
      useFuzzy: false,
      description: 'Short query (3-4 chars): prefix matching only'
    };
  }

  if (length <= 6) {
    return {
      mode: 'hybrid-low',
      usePrefix: true,
      useFuzzy: true,
      fuzzyThreshold: 0.2,
      description: 'Medium query (5-6 chars): prefix + fuzzy (low threshold)'
    };
  }

  return {
    mode: 'hybrid-standard',
    usePrefix: true,
    useFuzzy: true,
    fuzzyThreshold: 0.3,
    description: 'Long query (7+ chars): prefix + fuzzy (standard threshold)'
  };
}

/**
 * Merges and deduplicates search results from multiple sources
 * Prefix matches are prioritized over fuzzy matches
 */
export function mergeResults<T extends { customerId: number; matchScore?: number; matchType?: string }>(
  prefixResults: T[],
  fuzzyResults: T[]
): T[] {
  const merged = new Map<number, T>();

  // Add prefix results first (higher priority)
  for (const result of prefixResults) {
    if (!merged.has(result.customerId)) {
      merged.set(result.customerId, {
        ...result,
        matchType: 'prefix',
        matchScore: result.matchScore ?? 100
      });
    }
  }

  // Add fuzzy results, but don't override prefix matches
  for (const result of fuzzyResults) {
    if (!merged.has(result.customerId)) {
      merged.set(result.customerId, result);
    }
  }

  // Convert map to array and sort by match score (descending)
  return Array.from(merged.values()).sort((a, b) => {
    const scoreA = a.matchScore ?? 0;
    const scoreB = b.matchScore ?? 0;
    return scoreB - scoreA;
  });
}
