/**
 * Smart Matching Engine
 * 
 * Combines multiple fuzzy matching strategies:
 * 1. SOSL fuzzy search (Salesforce native)
 * 2. Local similarity algorithms (Levenshtein, Jaro-Winkler, Trigram, Soundex)
 * 3. Text normalization (multilingual support)
 * 
 * Provides confidence-scored results with intelligent ranking.
 */

import jsforce from 'jsforce';
import { CompositeSimilarityMatcher } from './similarity.js';
import { TextNormalizer } from './text-normalizer.js';

/**
 * Match confidence levels
 */
export enum MatchConfidence {
  HIGH = 'HIGH',      // >95% - Auto-suggest with high confidence
  MEDIUM = 'MEDIUM',  // 75-95% - Show for user disambiguation
  LOW = 'LOW'         // <75% - Possible match, low confidence
}

/**
 * Match result with confidence scoring
 */
export interface MatchResult {
  record: any;
  confidence: MatchConfidence;
  score: number;
  matchedBy: string[];
  normalizedInput: string;
  normalizedRecord: string;
}

/**
 * Search strategy configuration
 */
export interface SearchConfig {
  // Field to match against
  field: string;
  
  // Object type (Account, Contact, etc.)
  sobject: string;
  
  // Additional fields to return
  returnFields?: string[];
  
  // Maximum results to return
  limit?: number;
  
  // Minimum confidence level to include
  minConfidence?: MatchConfidence;
  
  // Custom similarity weights
  similarityWeights?: {
    levenshtein?: number;
    jaroWinkler?: number;
    trigram?: number;
    soundex?: number;
  };
}

/**
 * SOSL query result
 */
interface SOSLResult {
  searchRecords: any[];
}

/**
 * Smart Matcher for fuzzy matching and duplicate detection
 */
export class SmartMatcher {
  private similarityMatcher: CompositeSimilarityMatcher;
  private normalizer: TextNormalizer;
  
  // Confidence thresholds
  private readonly HIGH_THRESHOLD = 0.95;
  private readonly MEDIUM_THRESHOLD = 0.75;

  constructor() {
    this.similarityMatcher = new CompositeSimilarityMatcher();
    this.normalizer = new TextNormalizer();
  }

  /**
   * Find matches using multi-strategy approach
   */
  async findMatches(
    conn: jsforce.Connection,
    searchTerm: string,
    config: SearchConfig
  ): Promise<MatchResult[]> {
    const { sobject, field, returnFields = ['Id', 'Name'], limit = 10 } = config;

    // Normalize input
    const normalizedInput = this.normalizeForField(searchTerm, field);

    // Strategy 1: SOSL Multi-Query Pattern (5 queries)
    const soslResults = await this.executeSoslQueries(
      conn,
      searchTerm,
      sobject,
      field,
      returnFields
    );

    // Strategy 2: Local fuzzy matching on SOSL results
    const scoredResults = this.scoreResults(
      soslResults,
      normalizedInput,
      field,
      config
    );

    // Sort by score (highest first) and apply limit
    const sortedResults = scoredResults
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    // Filter by minimum confidence
    if (config.minConfidence) {
      return this.filterByConfidence(sortedResults, config.minConfidence);
    }

    return sortedResults;
  }

  /**
   * Execute multiple SOSL queries with different patterns
   */
  private async executeSoslQueries(
    conn: jsforce.Connection,
    searchTerm: string,
    sobject: string,
    field: string,
    returnFields: string[]
  ): Promise<any[]> {
    const allResults = new Map<string, any>(); // Deduplicate by Id

    try {
      // Query 1: Exact match (case-insensitive)
      const exactResults = await this.soslExactMatch(
        conn,
        searchTerm,
        sobject,
        field,
        returnFields
      );
      exactResults.forEach(r => allResults.set(r.Id, { ...r, matchedBy: ['exact'] }));

      // Query 2: Prefix match (starts with)
      const prefixResults = await this.soslPrefixMatch(
        conn,
        searchTerm,
        sobject,
        field,
        returnFields
      );
      prefixResults.forEach(r => {
        const existing = allResults.get(r.Id);
        if (existing) {
          existing.matchedBy.push('prefix');
        } else {
          allResults.set(r.Id, { ...r, matchedBy: ['prefix'] });
        }
      });

      // Query 3: Wildcard match (contains)
      const wildcardResults = await this.soslWildcardMatch(
        conn,
        searchTerm,
        sobject,
        field,
        returnFields
      );
      wildcardResults.forEach(r => {
        const existing = allResults.get(r.Id);
        if (existing) {
          existing.matchedBy.push('wildcard');
        } else {
          allResults.set(r.Id, { ...r, matchedBy: ['wildcard'] });
        }
      });

      // Query 4: Fuzzy match (SOSL native fuzzy)
      const fuzzyResults = await this.soslFuzzyMatch(
        conn,
        searchTerm,
        sobject,
        field,
        returnFields
      );
      fuzzyResults.forEach(r => {
        const existing = allResults.get(r.Id);
        if (existing) {
          existing.matchedBy.push('fuzzy');
        } else {
          allResults.set(r.Id, { ...r, matchedBy: ['fuzzy'] });
        }
      });

      // Query 5: Normalized match (remove diacritics, business suffixes)
      const normalizedTerm = this.normalizeForField(searchTerm, field);
      if (normalizedTerm !== searchTerm.toLowerCase()) {
        const normalizedResults = await this.soslExactMatch(
          conn,
          normalizedTerm,
          sobject,
          field,
          returnFields
        );
        normalizedResults.forEach(r => {
          const existing = allResults.get(r.Id);
          if (existing) {
            existing.matchedBy.push('normalized');
          } else {
            allResults.set(r.Id, { ...r, matchedBy: ['normalized'] });
          }
        });
      }

    } catch (error) {
      console.error('SOSL query error:', error);
      // Continue with whatever results we have
    }

    return Array.from(allResults.values());
  }

  /**
   * SOSL Query 1: Exact match
   */
  private async soslExactMatch(
    conn: jsforce.Connection,
    searchTerm: string,
    sobject: string,
    field: string,
    returnFields: string[]
  ): Promise<any[]> {
    try {
      const sosl = `FIND {${this.escapeSosl(searchTerm)}} IN ALL FIELDS RETURNING ${sobject}(${returnFields.join(', ')}) LIMIT 20`;
      const result = await conn.search(sosl) as SOSLResult;
      return result.searchRecords || [];
    } catch (error) {
      console.error('Exact match error:', error);
      return [];
    }
  }

  /**
   * SOSL Query 2: Prefix match (starts with)
   */
  private async soslPrefixMatch(
    conn: jsforce.Connection,
    searchTerm: string,
    sobject: string,
    field: string,
    returnFields: string[]
  ): Promise<any[]> {
    try {
      const sosl = `FIND {${this.escapeSosl(searchTerm)}*} IN ALL FIELDS RETURNING ${sobject}(${returnFields.join(', ')}) LIMIT 20`;
      const result = await conn.search(sosl) as SOSLResult;
      return result.searchRecords || [];
    } catch (error) {
      console.error('Prefix match error:', error);
      return [];
    }
  }

  /**
   * SOSL Query 3: Wildcard match (contains)
   */
  private async soslWildcardMatch(
    conn: jsforce.Connection,
    searchTerm: string,
    sobject: string,
    field: string,
    returnFields: string[]
  ): Promise<any[]> {
    try {
      const sosl = `FIND {*${this.escapeSosl(searchTerm)}*} IN ALL FIELDS RETURNING ${sobject}(${returnFields.join(', ')}) LIMIT 20`;
      const result = await conn.search(sosl) as SOSLResult;
      return result.searchRecords || [];
    } catch (error) {
      console.error('Wildcard match error:', error);
      return [];
    }
  }

  /**
   * SOSL Query 4: Fuzzy match (spelling variations)
   */
  private async soslFuzzyMatch(
    conn: jsforce.Connection,
    searchTerm: string,
    sobject: string,
    field: string,
    returnFields: string[]
  ): Promise<any[]> {
    try {
      // SOSL fuzzy search using ~ operator (if supported)
      // Note: Fuzzy search availability depends on Salesforce edition
      const sosl = `FIND {${this.escapeSosl(searchTerm)}~} IN ALL FIELDS RETURNING ${sobject}(${returnFields.join(', ')}) LIMIT 20`;
      const result = await conn.search(sosl) as SOSLResult;
      return result.searchRecords || [];
    } catch (error) {
      // Fuzzy search might not be available in all orgs
      console.error('Fuzzy match error (may not be supported):', error);
      return [];
    }
  }

  /**
   * Score results using local similarity algorithms
   */
  private scoreResults(
    records: any[],
    normalizedInput: string,
    field: string,
    config: SearchConfig
  ): MatchResult[] {
    return records.map(record => {
      const recordValue = record[field] || '';
      const normalizedRecord = this.normalizeForField(recordValue, field);

      // Calculate similarity score
      const similarity = this.similarityMatcher.similarity(
        normalizedInput,
        normalizedRecord,
        config.similarityWeights
      );

      // Boost score if matched by multiple strategies
      let boostedScore = similarity.score;
      if (record.matchedBy && record.matchedBy.length > 1) {
        // Add 5% boost per additional matching strategy
        const boost = (record.matchedBy.length - 1) * 0.05;
        boostedScore = Math.min(1.0, boostedScore + boost);
      }

      // Determine confidence level
      let confidence: MatchConfidence;
      if (boostedScore >= this.HIGH_THRESHOLD) {
        confidence = MatchConfidence.HIGH;
      } else if (boostedScore >= this.MEDIUM_THRESHOLD) {
        confidence = MatchConfidence.MEDIUM;
      } else {
        confidence = MatchConfidence.LOW;
      }

      return {
        record,
        confidence,
        score: boostedScore,
        matchedBy: record.matchedBy || [],
        normalizedInput,
        normalizedRecord
      };
    });
  }

  /**
   * Filter results by minimum confidence
   */
  private filterByConfidence(
    results: MatchResult[],
    minConfidence: MatchConfidence
  ): MatchResult[] {
    const confidenceOrder = {
      [MatchConfidence.HIGH]: 3,
      [MatchConfidence.MEDIUM]: 2,
      [MatchConfidence.LOW]: 1
    };

    const minLevel = confidenceOrder[minConfidence];
    return results.filter(r => confidenceOrder[r.confidence] >= minLevel);
  }

  /**
   * Normalize value based on field type
   */
  private normalizeForField(value: string, field: string): string {
    if (!value) return '';

    const fieldLower = field.toLowerCase();

    // Email fields
    if (fieldLower.includes('email')) {
      return this.normalizer.normalizeEmail(value);
    }

    // Company/Account name fields
    if (fieldLower.includes('account') || fieldLower === 'name') {
      return this.normalizer.normalizeCompanyName(value);
    }

    // Person name fields
    if (fieldLower.includes('firstname') || 
        fieldLower.includes('lastname') ||
        fieldLower.includes('fullname')) {
      return this.normalizer.normalizePersonName(value);
    }

    // Default: general search normalization
    return this.normalizer.normalizeForSearch(value);
  }

  /**
   * Escape special characters for SOSL
   */
  private escapeSosl(term: string): string {
    // SOSL reserved characters: ? & | ! { } [ ] ( ) ^ ~ * : \ " ' + -
    return term
      .replace(/[?&|!{}[\]()^~*:\\"\'+\-]/g, '\\$&')
      .trim();
  }

  /**
   * Find duplicates for a new record before creation
   */
  async findDuplicates(
    conn: jsforce.Connection,
    data: Record<string, any>,
    config: SearchConfig
  ): Promise<MatchResult[]> {
    const searchValue = data[config.field];
    if (!searchValue) {
      return [];
    }

    return this.findMatches(conn, searchValue, {
      ...config,
      minConfidence: MatchConfidence.MEDIUM // Only show medium+ confidence duplicates
    });
  }

  /**
   * Get user-friendly match summary
   */
  getMatchSummary(match: MatchResult): string {
    const { confidence, score, matchedBy } = match;
    const percentage = (score * 100).toFixed(1);
    const strategies = matchedBy.join(', ');

    return `${confidence} confidence (${percentage}%) - Matched by: ${strategies}`;
  }

  /**
   * Format matches for user disambiguation
   */
  formatMatchesForUser(matches: MatchResult[]): string {
    if (matches.length === 0) {
      return 'No potential duplicates found.';
    }

    let output = `Found ${matches.length} potential match${matches.length > 1 ? 'es' : ''}:\n\n`;

    matches.forEach((match, index) => {
      const record = match.record;
      output += `${index + 1}. ${record.Name || record.Id}\n`;
      output += `   ${this.getMatchSummary(match)}\n`;
      output += `   ID: ${record.Id}\n`;
      
      // Show additional fields
      Object.keys(record).forEach(key => {
        if (key !== 'Id' && key !== 'Name' && key !== 'matchedBy' && !key.startsWith('attributes')) {
          output += `   ${key}: ${record[key]}\n`;
        }
      });
      
      output += '\n';
    });

    return output;
  }
}
