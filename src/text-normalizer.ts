/**
 * Text Normalization for Multilingual Fuzzy Matching
 * 
 * Normalizes text for better matching across languages and formats:
 * - Diacritic removal (é → e, ñ → n, ü → u)
 * - Business suffix normalization (Corporation → Corp, Limited → Ltd)
 * - Case normalization (lowercase)
 * - Special character handling
 * - Whitespace normalization
 */

/**
 * Diacritic mapping for common characters
 */
const DIACRITIC_MAP: Record<string, string> = {
  // Latin Extended-A
  'à': 'a', 'á': 'a', 'â': 'a', 'ã': 'a', 'ä': 'a', 'å': 'a', 'æ': 'ae',
  'ç': 'c',
  'è': 'e', 'é': 'e', 'ê': 'e', 'ë': 'e',
  'ì': 'i', 'í': 'i', 'î': 'i', 'ï': 'i',
  'ñ': 'n',
  'ò': 'o', 'ó': 'o', 'ô': 'o', 'õ': 'o', 'ö': 'o', 'ø': 'o', 'œ': 'oe',
  'ù': 'u', 'ú': 'u', 'û': 'u', 'ü': 'u',
  'ý': 'y', 'ÿ': 'y',
  'ß': 'ss',
  
  // Uppercase variants
  'À': 'A', 'Á': 'A', 'Â': 'A', 'Ã': 'A', 'Ä': 'A', 'Å': 'A', 'Æ': 'AE',
  'Ç': 'C',
  'È': 'E', 'É': 'E', 'Ê': 'E', 'Ë': 'E',
  'Ì': 'I', 'Í': 'I', 'Î': 'I', 'Ï': 'I',
  'Ñ': 'N',
  'Ò': 'O', 'Ó': 'O', 'Ô': 'O', 'Õ': 'O', 'Ö': 'O', 'Ø': 'O', 'Œ': 'OE',
  'Ù': 'U', 'Ú': 'U', 'Û': 'U', 'Ü': 'U',
  'Ý': 'Y', 'Ÿ': 'Y',
  
  // Additional common diacritics
  'ą': 'a', 'ć': 'c', 'ę': 'e', 'ł': 'l', 'ń': 'n', 'ś': 's', 'ź': 'z', 'ż': 'z',
  'Ą': 'A', 'Ć': 'C', 'Ę': 'E', 'Ł': 'L', 'Ń': 'N', 'Ś': 'S', 'Ź': 'Z', 'Ż': 'Z',
  
  // Czech/Slovak
  'č': 'c', 'ď': 'd', 'ě': 'e', 'ň': 'n', 'ř': 'r', 'š': 's', 'ť': 't', 'ů': 'u', 'ž': 'z',
  'Č': 'C', 'Ď': 'D', 'Ě': 'E', 'Ň': 'N', 'Ř': 'R', 'Š': 'S', 'Ť': 'T', 'Ů': 'U', 'Ž': 'Z',
  
  // Turkish
  'ğ': 'g', 'ı': 'i', 'ş': 's',
  'Ğ': 'G', 'İ': 'I', 'Ş': 'S',
  
  // Icelandic
  'þ': 'th', 'ð': 'd',
  'Þ': 'TH', 'Ð': 'D'
};

/**
 * Business suffix mappings (variations → canonical form)
 */
const BUSINESS_SUFFIX_MAP: Record<string, string> = {
  // Corporation variations
  'corporation': 'corp',
  'incorporated': 'inc',
  'limited': 'ltd',
  'company': 'co',
  
  // International business forms
  'gesellschaft mit beschränkter haftung': 'gmbh',
  'gesellschaft mit beschrankter haftung': 'gmbh', // after diacritic removal
  'aktiengesellschaft': 'ag',
  'sociedad anónima': 'sa',
  'sociedad anonima': 'sa', // after diacritic removal
  'société anonyme': 'sa',
  'societe anonyme': 'sa', // after diacritic removal
  'sociedade anônima': 'sa',
  'sociedade anonima': 'sa', // after diacritic removal
  'limited liability company': 'llc',
  'limited liability partnership': 'llp',
  'public limited company': 'plc',
  
  // Abbreviation variations
  'corp.': 'corp',
  'inc.': 'inc',
  'ltd.': 'ltd',
  'co.': 'co',
  'llc.': 'llc',
  'llp.': 'llp',
  'plc.': 'plc',
  's.a.': 'sa',
  's.a.r.l.': 'sarl',
  'gmbh.': 'gmbh',
  'ag.': 'ag',
  
  // Common variations
  'limited company': 'ltd',
  'pvt ltd': 'pvt',
  'private limited': 'pvt',
  'pty ltd': 'pty',
  'proprietary limited': 'pty'
};

/**
 * Text normalization options
 */
export interface NormalizationOptions {
  removeDiacritics?: boolean;
  normalizeBusinessSuffixes?: boolean;
  lowercase?: boolean;
  removeSpecialChars?: boolean;
  normalizeWhitespace?: boolean;
  preserveAtSymbol?: boolean; // For emails
}

/**
 * Normalization result with metadata
 */
export interface NormalizationResult {
  original: string;
  normalized: string;
  changes: {
    diacriticsRemoved: number;
    suffixesNormalized: string[];
    specialCharsRemoved: number;
  };
}

/**
 * Text Normalizer for multilingual support
 */
export class TextNormalizer {
  private defaultOptions: NormalizationOptions = {
    removeDiacritics: true,
    normalizeBusinessSuffixes: true,
    lowercase: true,
    removeSpecialChars: false,
    normalizeWhitespace: true,
    preserveAtSymbol: false
  };

  /**
   * Normalize text with detailed tracking
   */
  normalizeWithMetadata(
    text: string,
    options?: Partial<NormalizationOptions>
  ): NormalizationResult {
    const opts = { ...this.defaultOptions, ...options };
    
    let normalized = text;
    const changes = {
      diacriticsRemoved: 0,
      suffixesNormalized: [] as string[],
      specialCharsRemoved: 0
    };

    // 1. Remove diacritics
    if (opts.removeDiacritics) {
      const beforeLength = normalized.length;
      normalized = this.removeDiacritics(normalized);
      changes.diacriticsRemoved = beforeLength - normalized.length;
    }

    // 2. Lowercase
    if (opts.lowercase) {
      normalized = normalized.toLowerCase();
    }

    // 3. Normalize business suffixes
    if (opts.normalizeBusinessSuffixes) {
      const result = this.normalizeBusinessSuffixes(normalized);
      normalized = result.text;
      changes.suffixesNormalized = result.normalized;
    }

    // 4. Remove special characters (before whitespace normalization)
    if (opts.removeSpecialChars) {
      const beforeLength = normalized.length;
      normalized = this.removeSpecialChars(normalized, opts.preserveAtSymbol);
      changes.specialCharsRemoved = beforeLength - normalized.length;
    }

    // 5. Normalize whitespace (always last to clean up after other operations)
    if (opts.normalizeWhitespace) {
      normalized = this.normalizeWhitespace(normalized);
    }

    return {
      original: text,
      normalized: normalized.trim(),
      changes
    };
  }

  /**
   * Quick normalize (most common use case)
   */
  normalize(text: string, options?: Partial<NormalizationOptions>): string {
    return this.normalizeWithMetadata(text, options).normalized;
  }

  /**
   * Remove diacritics from text
   */
  private removeDiacritics(text: string): string {
    let result = '';
    for (const char of text) {
      result += DIACRITIC_MAP[char] || char;
    }
    return result;
  }

  /**
   * Normalize business suffixes
   */
  private normalizeBusinessSuffixes(text: string): {
    text: string;
    normalized: string[];
  } {
    let result = text;
    const normalized: string[] = [];

    // Sort by length (longest first) to handle multi-word suffixes
    const suffixes = Object.keys(BUSINESS_SUFFIX_MAP).sort(
      (a, b) => b.length - a.length
    );

    for (const suffix of suffixes) {
      const regex = new RegExp(`\\b${suffix}\\b`, 'gi');
      if (regex.test(result)) {
        const canonical = BUSINESS_SUFFIX_MAP[suffix];
        result = result.replace(regex, canonical);
        normalized.push(`${suffix} → ${canonical}`);
      }
    }

    return { text: result, normalized };
  }

  /**
   * Normalize whitespace
   */
  private normalizeWhitespace(text: string): string {
    return text
      .replace(/\s+/g, ' ')  // Multiple spaces → single space
      .replace(/\.+$/, '')    // Remove trailing periods (end of string)
      .trim();
  }

  /**
   * Remove special characters
   */
  private removeSpecialChars(text: string, preserveAtSymbol = false): string {
    if (preserveAtSymbol) {
      // Keep alphanumeric, spaces, and @ symbol
      return text.replace(/[^a-zA-Z0-9\s@]/g, '');
    } else {
      // Keep only alphanumeric and spaces
      return text.replace(/[^a-zA-Z0-9\s]/g, '');
    }
  }

  /**
   * Normalize email address
   */
  normalizeEmail(email: string): string {
    return this.normalize(email, {
      removeDiacritics: true,
      normalizeBusinessSuffixes: false,
      lowercase: true,
      removeSpecialChars: false,
      normalizeWhitespace: true,
      preserveAtSymbol: true
    });
  }

  /**
   * Normalize company name
   */
  normalizeCompanyName(name: string): string {
    return this.normalize(name, {
      removeDiacritics: true,
      normalizeBusinessSuffixes: true,
      lowercase: true,
      removeSpecialChars: false,
      normalizeWhitespace: true
    });
  }

  /**
   * Normalize person name
   */
  normalizePersonName(name: string): string {
    return this.normalize(name, {
      removeDiacritics: true,
      normalizeBusinessSuffixes: false,
      lowercase: true,
      removeSpecialChars: false,
      normalizeWhitespace: true
    });
  }

  /**
   * Normalize for search (most aggressive)
   */
  normalizeForSearch(text: string): string {
    return this.normalize(text, {
      removeDiacritics: true,
      normalizeBusinessSuffixes: true,
      lowercase: true,
      removeSpecialChars: true,
      normalizeWhitespace: true,
      preserveAtSymbol: false
    });
  }
}
