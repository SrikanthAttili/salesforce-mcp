/**
 * Similarity Algorithms for Fuzzy Matching
 * 
 * Implements multiple string similarity algorithms:
 * - Levenshtein Distance (edit distance for typos)
 * - Jaro-Winkler Similarity (string similarity with prefix weight)
 * - Trigram Similarity (n-gram based partial matching)
 * - Soundex (phonetic matching)
 */

/**
 * Levenshtein Distance - Edit Distance Algorithm
 * 
 * Calculates the minimum number of single-character edits (insertions,
 * deletions, or substitutions) required to change one string into another.
 * 
 * Good for: Handling typos and small spelling mistakes
 * Example: "Acme" vs "Acmme" = distance of 1
 */
export class LevenshteinMatcher {
  /**
   * Calculate Levenshtein distance between two strings
   */
  distance(str1: string, str2: string): number {
    const len1 = str1.length;
    const len2 = str2.length;

    // Create matrix
    const matrix: number[][] = Array(len2 + 1)
      .fill(null)
      .map(() => Array(len1 + 1).fill(0));

    // Initialize first column and row
    for (let i = 0; i <= len2; i++) {
      matrix[i][0] = i;
    }
    for (let j = 0; j <= len1; j++) {
      matrix[0][j] = j;
    }

    // Fill the matrix
    for (let i = 1; i <= len2; i++) {
      for (let j = 1; j <= len1; j++) {
        const cost = str2.charAt(i - 1) === str1.charAt(j - 1) ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,      // deletion
          matrix[i][j - 1] + 1,      // insertion
          matrix[i - 1][j - 1] + cost // substitution
        );
      }
    }

    return matrix[len2][len1];
  }

  /**
   * Calculate similarity score (0.0 - 1.0)
   * 1.0 = exact match, 0.0 = completely different
   */
  similarity(str1: string, str2: string): number {
    if (!str1 || !str2) return 0;
    if (str1 === str2) return 1.0;

    const distance = this.distance(
      str1.toLowerCase(),
      str2.toLowerCase()
    );
    const maxLen = Math.max(str1.length, str2.length);
    
    return 1 - (distance / maxLen);
  }
}

/**
 * Jaro-Winkler Similarity
 * 
 * String similarity algorithm that gives more weight to strings that
 * match from the beginning (prefix matching).
 * 
 * Good for: Short strings, names, and when prefix matters
 * Example: "IBM" vs "IBM Corporation" = high similarity
 */
export class JaroWinklerMatcher {
  private readonly SCALING_FACTOR = 0.1;
  private readonly PREFIX_LENGTH = 4;

  /**
   * Calculate Jaro similarity
   */
  private jaro(str1: string, str2: string): number {
    if (!str1 || !str2) return 0;
    if (str1 === str2) return 1.0;

    const len1 = str1.length;
    const len2 = str2.length;

    // Maximum distance for matches
    const matchDistance = Math.floor(Math.max(len1, len2) / 2) - 1;

    const matches1 = new Array(len1).fill(false);
    const matches2 = new Array(len2).fill(false);

    let matches = 0;
    let transpositions = 0;

    // Find matches
    for (let i = 0; i < len1; i++) {
      const start = Math.max(0, i - matchDistance);
      const end = Math.min(i + matchDistance + 1, len2);

      for (let j = start; j < end; j++) {
        if (matches2[j] || str1[i] !== str2[j]) continue;
        matches1[i] = true;
        matches2[j] = true;
        matches++;
        break;
      }
    }

    if (matches === 0) return 0;

    // Count transpositions
    let k = 0;
    for (let i = 0; i < len1; i++) {
      if (!matches1[i]) continue;
      while (!matches2[k]) k++;
      if (str1[i] !== str2[k]) transpositions++;
      k++;
    }

    return (
      (matches / len1 +
        matches / len2 +
        (matches - transpositions / 2) / matches) /
      3
    );
  }

  /**
   * Calculate Jaro-Winkler similarity (0.0 - 1.0)
   * Enhanced Jaro with prefix bonus
   */
  similarity(str1: string, str2: string): number {
    if (!str1 || !str2) return 0;
    if (str1 === str2) return 1.0;

    const s1 = str1.toLowerCase();
    const s2 = str2.toLowerCase();

    const jaroSim = this.jaro(s1, s2);

    // Find common prefix length (up to PREFIX_LENGTH)
    let prefixLength = 0;
    for (let i = 0; i < Math.min(s1.length, s2.length, this.PREFIX_LENGTH); i++) {
      if (s1[i] === s2[i]) {
        prefixLength++;
      } else {
        break;
      }
    }

    // Apply prefix bonus
    return jaroSim + prefixLength * this.SCALING_FACTOR * (1 - jaroSim);
  }
}

/**
 * Trigram (N-gram) Similarity
 * 
 * Breaks strings into overlapping 3-character sequences and compares them.
 * Works well even when strings have significant differences.
 * 
 * Good for: Partial matches, robust to insertions/deletions
 * Example: "Microsoft" vs "Microsft" = still high similarity
 */
export class TrigramMatcher {
  /**
   * Extract trigrams from a string
   */
  private getTrigrams(str: string): Set<string> {
    const trigrams = new Set<string>();
    const padded = `  ${str.toLowerCase()}  `;

    for (let i = 0; i < padded.length - 2; i++) {
      trigrams.add(padded.substring(i, i + 3));
    }

    return trigrams;
  }

  /**
   * Calculate trigram similarity (0.0 - 1.0)
   * Based on Dice coefficient
   */
  similarity(str1: string, str2: string): number {
    if (!str1 || !str2) return 0;
    if (str1 === str2) return 1.0;

    const trigrams1 = this.getTrigrams(str1);
    const trigrams2 = this.getTrigrams(str2);

    if (trigrams1.size === 0 || trigrams2.size === 0) return 0;

    // Count intersection
    let intersection = 0;
    for (const trigram of trigrams1) {
      if (trigrams2.has(trigram)) {
        intersection++;
      }
    }

    // Dice coefficient: 2 * |intersection| / (|set1| + |set2|)
    return (2 * intersection) / (trigrams1.size + trigrams2.size);
  }
}

/**
 * Soundex Algorithm
 * 
 * Phonetic algorithm that indexes strings by their sound when pronounced.
 * Useful for matching names that sound similar but are spelled differently.
 * 
 * Good for: Name matching, phonetic similarity
 * Example: "Smith" vs "Smyth" = same soundex code
 */
export class SoundexMatcher {
  private readonly CODE_LENGTH = 4;

  /**
   * Generate Soundex code for a string
   */
  encode(str: string): string {
    if (!str) return '';

    const upper = str.toUpperCase();
    let code = upper.charAt(0);

    // Soundex mapping
    const mapping: Record<string, string> = {
      B: '1', F: '1', P: '1', V: '1',
      C: '2', G: '2', J: '2', K: '2', Q: '2', S: '2', X: '2', Z: '2',
      D: '3', T: '3',
      L: '4',
      M: '5', N: '5',
      R: '6'
    };

    let prevCode = this.getCode(upper.charAt(0), mapping);

    for (let i = 1; i < upper.length && code.length < this.CODE_LENGTH; i++) {
      const char = upper.charAt(i);
      const currentCode = this.getCode(char, mapping);

      // Skip vowels and duplicate codes
      if (currentCode !== '0' && currentCode !== prevCode) {
        code += currentCode;
        prevCode = currentCode;
      } else if (currentCode !== '0') {
        prevCode = currentCode;
      }
    }

    // Pad with zeros
    return code.padEnd(this.CODE_LENGTH, '0');
  }

  private getCode(char: string, mapping: Record<string, string>): string {
    return mapping[char] || '0';
  }

  /**
   * Check if two strings have matching Soundex codes
   */
  matches(str1: string, str2: string): boolean {
    if (!str1 || !str2) return false;
    return this.encode(str1) === this.encode(str2);
  }

  /**
   * Calculate similarity based on Soundex match
   * Returns 1.0 if match, 0.0 if no match
   */
  similarity(str1: string, str2: string): number {
    return this.matches(str1, str2) ? 1.0 : 0.0;
  }
}

/**
 * Composite Similarity Matcher
 * 
 * Combines multiple algorithms with configurable weights
 * to produce a final similarity score.
 */
export interface SimilarityWeights {
  levenshtein: number;
  jaroWinkler: number;
  trigram: number;
  soundex: number;
}

export interface SimilarityResult {
  score: number;
  scores: {
    levenshtein: number;
    jaroWinkler: number;
    trigram: number;
    soundex: number;
  };
  algorithm: string;
}

export class CompositeSimilarityMatcher {
  private levenshtein = new LevenshteinMatcher();
  private jaroWinkler = new JaroWinklerMatcher();
  private trigram = new TrigramMatcher();
  private soundex = new SoundexMatcher();

  // Default weights (sum should be 1.0)
  private defaultWeights: SimilarityWeights = {
    levenshtein: 0.3,
    jaroWinkler: 0.4,
    trigram: 0.2,
    soundex: 0.1
  };

  /**
   * Calculate weighted similarity using all algorithms
   */
  similarity(
    str1: string,
    str2: string,
    weights?: Partial<SimilarityWeights>
  ): SimilarityResult {
    // Use provided weights or defaults
    const w = { ...this.defaultWeights, ...weights };

    // Calculate individual scores
    const scores = {
      levenshtein: this.levenshtein.similarity(str1, str2),
      jaroWinkler: this.jaroWinkler.similarity(str1, str2),
      trigram: this.trigram.similarity(str1, str2),
      soundex: this.soundex.similarity(str1, str2)
    };

    // Weighted average
    const score =
      scores.levenshtein * w.levenshtein +
      scores.jaroWinkler * w.jaroWinkler +
      scores.trigram * w.trigram +
      scores.soundex * w.soundex;

    // Determine which algorithm contributed most
    const maxScore = Math.max(
      scores.levenshtein,
      scores.jaroWinkler,
      scores.trigram,
      scores.soundex
    );

    let algorithm = 'COMPOSITE';
    if (scores.levenshtein === maxScore) algorithm = 'LEVENSHTEIN';
    else if (scores.jaroWinkler === maxScore) algorithm = 'JARO_WINKLER';
    else if (scores.trigram === maxScore) algorithm = 'TRIGRAM';
    else if (scores.soundex === maxScore) algorithm = 'SOUNDEX';

    return {
      score,
      scores,
      algorithm
    };
  }
}
