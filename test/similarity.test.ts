/**
 * Comprehensive Tests for Similarity Algorithms
 */

import { strict as assert } from 'assert';
import {
  LevenshteinMatcher,
  JaroWinklerMatcher,
  TrigramMatcher,
  SoundexMatcher,
  CompositeSimilarityMatcher
} from '../src/similarity.js';

console.log('Testing Similarity Algorithms...\n');

// Test Levenshtein Distance
console.log('1. Testing Levenshtein Distance');
const levenshtein = new LevenshteinMatcher();

// Exact match
assert.strictEqual(levenshtein.distance('Acme', 'Acme'), 0);
assert.strictEqual(levenshtein.similarity('Acme', 'Acme'), 1.0);

// Single character typo
assert.strictEqual(levenshtein.distance('Acme', 'Acmme'), 1);
assert(levenshtein.similarity('Acme', 'Acmme') > 0.75);

// Multiple edits
assert.strictEqual(levenshtein.distance('kitten', 'sitting'), 3);
assert(levenshtein.similarity('kitten', 'sitting') > 0.5);

// Completely different
assert(levenshtein.similarity('Apple', 'Zebra') < 0.3);

// Case insensitive
assert.strictEqual(levenshtein.similarity('ACME', 'acme'), 1.0);

console.log('✅ Levenshtein: All tests passed');

// Test Jaro-Winkler Similarity
console.log('\n2. Testing Jaro-Winkler Similarity');
const jaroWinkler = new JaroWinklerMatcher();

// Exact match
assert.strictEqual(jaroWinkler.similarity('IBM', 'IBM'), 1.0);

// Prefix bonus (strings starting the same)
const ibmSimilarity = jaroWinkler.similarity('IBM', 'IBM Corporation');
assert(ibmSimilarity > 0.7, `IBM vs IBM Corporation should be >0.7, got ${ibmSimilarity}`);

// Common names
assert(jaroWinkler.similarity('Martha', 'Marhta') > 0.9);
assert(jaroWinkler.similarity('DIXON', 'DICKSONX') > 0.75);

// Different strings
assert(jaroWinkler.similarity('Apple', 'Zebra') < 0.5);

// Case insensitive
assert.strictEqual(jaroWinkler.similarity('MICROSOFT', 'microsoft'), 1.0);

console.log('✅ Jaro-Winkler: All tests passed');

// Test Trigram Similarity
console.log('\n3. Testing Trigram Similarity');
const trigram = new TrigramMatcher();

// Exact match
assert.strictEqual(trigram.similarity('Microsoft', 'Microsoft'), 1.0);

// Missing character (Microsft) - trigram gives ~0.76
assert(trigram.similarity('Microsoft', 'Microsft') > 0.7);

// Partial match
assert(trigram.similarity('International', 'Intl') > 0.3);

// Word order doesn't matter much
assert(trigram.similarity('ABC Corp', 'Corp ABC') > 0.6);

// Completely different
assert(trigram.similarity('Apple', 'Zebra') < 0.2);

// Case insensitive - allow floating point error
const trigramCase = trigram.similarity('GOOGLE', 'google');
assert(Math.abs(trigramCase - 1.0) < 0.0001, `Case should be ~1.0, got ${trigramCase}`);

console.log('✅ Trigram: All tests passed');

// Test Soundex
console.log('\n4. Testing Soundex');
const soundex = new SoundexMatcher();

// Same Soundex code
assert.strictEqual(soundex.encode('Smith'), 'S530');
assert.strictEqual(soundex.encode('Smyth'), 'S530');
assert(soundex.matches('Smith', 'Smyth'));
assert.strictEqual(soundex.similarity('Smith', 'Smyth'), 1.0);

// Different pronunciations
assert.strictEqual(soundex.encode('Robert'), 'R163');
assert.strictEqual(soundex.encode('Rupert'), 'R163');
assert(soundex.matches('Robert', 'Rupert'));

// Similar spelling, different sound
assert(!soundex.matches('Apple', 'Apples')); // Differ slightly
assert(!soundex.matches('Cat', 'Dog'));

// Case insensitive
assert(soundex.matches('JOHNSON', 'johnson'));

// Phonetic matches
assert(soundex.matches('Johnson', 'Jonson'));
assert(soundex.matches('Peterson', 'Petersen'));

console.log('✅ Soundex: All tests passed');

// Test Composite Matcher
console.log('\n5. Testing Composite Similarity Matcher');
const composite = new CompositeSimilarityMatcher();

// Exact match
const exactResult = composite.similarity('Acme Corporation', 'Acme Corporation');
assert(Math.abs(exactResult.score - 1.0) < 0.0001, `Score should be ~1.0, got ${exactResult.score}`);
assert.strictEqual(exactResult.scores.levenshtein, 1.0);
assert(Math.abs(exactResult.scores.jaroWinkler - 1.0) < 0.0001); // Allow floating point error
assert(Math.abs(exactResult.scores.trigram - 1.0) < 0.0001); // Allow tiny floating point error

// Typo (Acmme)
const typoResult = composite.similarity('Acme Corporation', 'Acmme Corporation');
assert(typoResult.score > 0.9, `Typo similarity should be >0.9, got ${typoResult.score}`);

// Abbreviation
const abbrResult = composite.similarity('International Business Machines', 'IBM');
assert(abbrResult.score > 0.2, `Abbreviation should have some similarity, got ${abbrResult.score}`);

// Phonetic match
const phoneticResult = composite.similarity('Smith', 'Smyth');
assert(phoneticResult.score > 0.8, `Phonetic match should be >0.8, got ${phoneticResult.score}`);

// Different strings
const diffResult = composite.similarity('Apple Inc', 'Zebra Corp');
assert(diffResult.score < 0.3, `Different strings should be <0.3, got ${diffResult.score}`);

// Custom weights (emphasize Jaro-Winkler for names)
const nameResult = composite.similarity(
  'John Smith',
  'Jon Smyth',
  { jaroWinkler: 0.6, levenshtein: 0.2, trigram: 0.1, soundex: 0.1 }
);
assert(nameResult.score > 0.75, `Name match with custom weights should be >0.75, got ${nameResult.score}`);

console.log('✅ Composite: All tests passed');

// Real-world test cases
console.log('\n6. Real-World Test Cases');

// Company name variations
const test1 = composite.similarity('Microsoft Corporation', 'Microsoft Corp');
assert(test1.score > 0.80, `Microsoft variations should be >0.80, got ${test1.score}`);
console.log(`  Microsoft Corporation vs Microsoft Corp: ${(test1.score * 100).toFixed(1)}%`);

// Typo in company name
const test2 = composite.similarity('Google LLC', 'Gogle LLC');
assert(test2.score > 0.85, `Google typo should be >0.85, got ${test2.score}`);
console.log(`  Google LLC vs Gogle LLC (typo): ${(test2.score * 100).toFixed(1)}%`);

// Multilingual spelling (before normalization) - diacritic creates small difference
const test3 = composite.similarity('Café Inc', 'Cafe Inc');
assert(test3.score > 0.85, `Café vs Cafe should be >0.85, got ${test3.score}`);
console.log(`  Café Inc vs Cafe Inc: ${(test3.score * 100).toFixed(1)}%`);

// Business suffix variations
const test4 = composite.similarity('Acme Corporation', 'Acme Corp');
assert(test4.score > 0.75, `Corp variations should be >0.75, got ${test4.score}`);
console.log(`  Acme Corporation vs Acme Corp: ${(test4.score * 100).toFixed(1)}%`);

// Contact name variations
const test5 = composite.similarity('John Smith', 'Jon Smyth');
assert(test5.score > 0.75, `Name variations should be >0.75, got ${test5.score}`);
console.log(`  John Smith vs Jon Smyth: ${(test5.score * 100).toFixed(1)}%`);

// Email domain match
const test6 = composite.similarity('sales@acme.com', 'sales@acmme.com');
assert(test6.score > 0.9, `Email typo should be >0.9, got ${test6.score}`);
console.log(`  sales@acme.com vs sales@acmme.com: ${(test6.score * 100).toFixed(1)}%`);

console.log('✅ Real-world cases: All tests passed');

// Edge cases
console.log('\n7. Edge Cases');

// Empty strings
assert.strictEqual(composite.similarity('', '').score, 0);
assert.strictEqual(composite.similarity('test', '').score, 0);
assert.strictEqual(composite.similarity('', 'test').score, 0);

// Very short strings
const short = composite.similarity('A', 'B');
assert(short.score < 0.5);

// Very long strings (performance test) - soundex pulls score down for repetitive chars
const long1 = 'A'.repeat(1000);
const long2 = 'A'.repeat(999) + 'B';
const longResult = composite.similarity(long1, long2);
assert(longResult.score > 0.80, `Long string similarity should be >0.80, got ${longResult.score}`);

// Numbers
const numbers = composite.similarity('12345', '12346');
assert(numbers.score > 0.8);

// Special characters
const special = composite.similarity('test@123', 'test@124');
assert(special.score > 0.85);

console.log('✅ Edge cases: All tests passed');

// Performance summary
console.log('\n8. Performance Summary');

const iterations = 1000;
const startTime = Date.now();

for (let i = 0; i < iterations; i++) {
  composite.similarity('Acme Corporation', 'Acmme Corp');
}

const endTime = Date.now();
const avgTime = (endTime - startTime) / iterations;

console.log(`  ${iterations} similarity calculations in ${endTime - startTime}ms`);
console.log(`  Average: ${avgTime.toFixed(2)}ms per comparison`);
assert(avgTime < 5, `Average time should be <5ms, got ${avgTime.toFixed(2)}ms`);

console.log('✅ Performance: Acceptable');

console.log('\n✅ ALL SIMILARITY TESTS PASSED\n');
console.log('Summary:');
console.log('  - Levenshtein: Edit distance for typos ✓');
console.log('  - Jaro-Winkler: String similarity with prefix bonus ✓');
console.log('  - Trigram: N-gram based partial matching ✓');
console.log('  - Soundex: Phonetic matching ✓');
console.log('  - Composite: Multi-algorithm weighted scoring ✓');
console.log('  - Real-world cases: Company names, contacts, emails ✓');
console.log('  - Edge cases: Empty, short, long, special chars ✓');
console.log(`  - Performance: ${avgTime.toFixed(2)}ms average ✓`);
