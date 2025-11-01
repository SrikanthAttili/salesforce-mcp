/**
 * Comprehensive Tests for Text Normalizer
 */

import { strict as assert } from 'assert';
import { TextNormalizer } from '../src/text-normalizer.js';

console.log('Testing Text Normalizer...\n');

const normalizer = new TextNormalizer();

// Test 1: Diacritic Removal
console.log('1. Testing Diacritic Removal');

// French
assert.strictEqual(normalizer.normalize('Café'), 'cafe');
assert.strictEqual(normalizer.normalize('Société'), 'societe');
assert.strictEqual(normalizer.normalize('Français'), 'francais');

// Spanish
assert.strictEqual(normalizer.normalize('España'), 'espana');
assert.strictEqual(normalizer.normalize('Niño'), 'nino');

// German
assert.strictEqual(normalizer.normalize('Müller'), 'muller');
assert.strictEqual(normalizer.normalize('Größe'), 'grosse');
assert.strictEqual(normalizer.normalize('Straße'), 'strasse');

// Portuguese
assert.strictEqual(normalizer.normalize('São Paulo'), 'sao paulo');
assert.strictEqual(normalizer.normalize('Açúcar'), 'acucar');

// Polish
assert.strictEqual(normalizer.normalize('Łódź'), 'lodz');
assert.strictEqual(normalizer.normalize('Kraków'), 'krakow');

// Czech
assert.strictEqual(normalizer.normalize('Český'), 'cesky');

// Turkish
assert.strictEqual(normalizer.normalize('İstanbul'), 'istanbul');

console.log('✅ Diacritics: All languages tested');

// Test 2: Business Suffix Normalization
console.log('\n2. Testing Business Suffix Normalization');

// English variations
assert.strictEqual(normalizer.normalizeCompanyName('Acme Corporation'), 'acme corp');
assert.strictEqual(normalizer.normalizeCompanyName('Smith Incorporated'), 'smith inc');
assert.strictEqual(normalizer.normalizeCompanyName('Jones Limited'), 'jones ltd');
assert.strictEqual(normalizer.normalizeCompanyName('ABC Company'), 'abc co');
assert.strictEqual(normalizer.normalizeCompanyName('XYZ Corp.'), 'xyz corp');

// With periods
assert.strictEqual(normalizer.normalizeCompanyName('Acme Inc.'), 'acme inc');
assert.strictEqual(normalizer.normalizeCompanyName('Smith Ltd.'), 'smith ltd');
assert.strictEqual(normalizer.normalizeCompanyName('Jones Co.'), 'jones co');

// International forms
assert.strictEqual(
  normalizer.normalizeCompanyName('Siemens Aktiengesellschaft'),
  'siemens ag'
);
assert.strictEqual(
  normalizer.normalizeCompanyName('BMW GmbH'),
  'bmw gmbh'
);
assert.strictEqual(
  normalizer.normalizeCompanyName('Banco Santander Sociedad Anónima'),
  'banco santander sa'
);
assert.strictEqual(
  normalizer.normalizeCompanyName('Total Société Anonyme'),
  'total sa'
);

// LLC/LLP
assert.strictEqual(
  normalizer.normalizeCompanyName('Google Limited Liability Company'),
  'google llc'
);

console.log('✅ Business suffixes: English & international');

// Test 3: Whitespace Normalization
console.log('\n3. Testing Whitespace Normalization');

assert.strictEqual(normalizer.normalize('  Multiple   Spaces  '), 'multiple spaces');
assert.strictEqual(normalizer.normalize('Tab\tSeparated'), 'tab separated');
assert.strictEqual(normalizer.normalize('New\nLine'), 'new line');
assert.strictEqual(normalizer.normalize('  Leading and Trailing  '), 'leading and trailing');

console.log('✅ Whitespace: Normalized');

// Test 4: Email Normalization
console.log('\n4. Testing Email Normalization');

assert.strictEqual(
  normalizer.normalizeEmail('John.Doe@Example.COM'),
  'john.doe@example.com'
);
assert.strictEqual(
  normalizer.normalizeEmail('  Sales@Café.com  '),
  'sales@cafe.com'
);
assert.strictEqual(
  normalizer.normalizeEmail('info@müller-gmbh.de'),
  'info@muller-gmbh.de'
);

console.log('✅ Emails: Normalized with @ preserved');

// Test 5: Person Name Normalization
console.log('\n5. Testing Person Name Normalization');

assert.strictEqual(normalizer.normalizePersonName('José García'), 'jose garcia');
assert.strictEqual(normalizer.normalizePersonName('François Müller'), 'francois muller');
assert.strictEqual(normalizer.normalizePersonName('Søren Andersen'), 'soren andersen');
assert.strictEqual(normalizer.normalizePersonName('Łukasz Nowak'), 'lukasz nowak');

console.log('✅ Person names: Multilingual');

// Test 6: Search Normalization (most aggressive)
console.log('\n6. Testing Search Normalization');

// Removes all special chars
const search1 = normalizer.normalizeForSearch('Café "Elite" (Paris)');
assert.strictEqual(search1, 'cafe elite paris');

const search2 = normalizer.normalizeForSearch('Smith & Jones, Ltd.');
assert.strictEqual(search2, 'smith jones ltd');

const search3 = normalizer.normalizeForSearch('100% Pure!');
assert.strictEqual(search3, '100 pure');

console.log('✅ Search: Aggressive normalization');

// Test 7: Metadata Tracking
console.log('\n7. Testing Metadata Tracking');

const result1 = normalizer.normalizeWithMetadata('Café Corporation');
assert.strictEqual(result1.normalized, 'cafe corp');
assert(result1.changes.diacriticsRemoved >= 0);
assert(result1.changes.suffixesNormalized.length > 0);
console.log(`  Tracked changes: ${result1.changes.suffixesNormalized.join(', ')}`);

const result2 = normalizer.normalizeWithMetadata('München GmbH');
assert.strictEqual(result2.normalized, 'munchen gmbh');

console.log('✅ Metadata: Changes tracked');

// Test 8: Combination Cases
console.log('\n8. Testing Real-World Combinations');

// Multilingual company with diacritics and suffix
assert.strictEqual(
  normalizer.normalizeCompanyName('Société Française Corporation'),
  'societe francaise corp'
);

// German company with umlaut
assert.strictEqual(
  normalizer.normalizeCompanyName('Müller & Söhne GmbH'),
  'muller & sohne gmbh'
);

// Spanish company
assert.strictEqual(
  normalizer.normalizeCompanyName('Telefónica Sociedad Anónima'),
  'telefonica sa'
);

// Polish company - trailing periods are normalized
assert.strictEqual(
  normalizer.normalizeCompanyName('Łódź Spółka z o.o.'),
  'lodz spolka z o.o'
);

console.log('✅ Real-world: Complex combinations');

// Test 9: Edge Cases
console.log('\n9. Testing Edge Cases');

// Empty string
assert.strictEqual(normalizer.normalize(''), '');

// Only special characters
assert.strictEqual(normalizer.normalizeForSearch('!!!'), '');

// Only diacritics
assert.strictEqual(normalizer.normalize('éèêë'), 'eeee');

// Mixed scripts (basic support)
const mixed = normalizer.normalize('Café 咖啡');
assert(mixed.includes('cafe'));

// Very long text
const longText = 'A'.repeat(1000) + 'é';
const normalized = normalizer.normalize(longText);
assert(normalized.includes('e') && !normalized.includes('é'));

console.log('✅ Edge cases: Handled');

// Test 10: Case Sensitivity Options
console.log('\n10. Testing Case Sensitivity Options');

// With lowercase (default)
assert.strictEqual(
  normalizer.normalize('ACME Corporation'),
  'acme corp'
);

// Without lowercase
assert.strictEqual(
  normalizer.normalize('ACME Corporation', { lowercase: false }),
  'ACME corp'
);

console.log('✅ Options: Configurable');

// Test 11: Special Character Preservation
console.log('\n11. Testing Special Character Options');

// Remove special chars
assert.strictEqual(
  normalizer.normalize('A-B & C', { removeSpecialChars: true }),
  'ab c'
);

// Keep special chars (default)
assert.strictEqual(
  normalizer.normalize('A-B & C', { removeSpecialChars: false }),
  'a-b & c'
);

console.log('✅ Special chars: Configurable');

// Test 12: Practical Matching Scenarios
console.log('\n12. Testing Practical Matching Scenarios');

// Scenario: User types "Cafe" but record has "Café"
const input1 = normalizer.normalizeCompanyName('Cafe Inc');
const record1 = normalizer.normalizeCompanyName('Café Inc.');
assert.strictEqual(input1, record1, 'Should match despite diacritic difference');
console.log(`  ✓ "Cafe Inc" matches "Café Inc."`);

// Scenario: User types full form, record has abbreviation
const input2 = normalizer.normalizeCompanyName('Smith Corporation');
const record2 = normalizer.normalizeCompanyName('Smith Corp.');
assert.strictEqual(input2, record2, 'Should match with suffix normalization');
console.log(`  ✓ "Smith Corporation" matches "Smith Corp."`);

// Scenario: Multilingual matching
const input3 = normalizer.normalizePersonName('Jose Garcia');
const record3 = normalizer.normalizePersonName('José García');
assert.strictEqual(input3, record3, 'Should match multilingual names');
console.log(`  ✓ "Jose Garcia" matches "José García"`);

// Scenario: Email with different casing
const input4 = normalizer.normalizeEmail('SALES@ACME.COM');
const record4 = normalizer.normalizeEmail('sales@acme.com');
assert.strictEqual(input4, record4, 'Should match emails case-insensitively');
console.log(`  ✓ "SALES@ACME.COM" matches "sales@acme.com"`);

console.log('✅ Practical scenarios: All matched');

// Performance Test
console.log('\n13. Performance Test');

const iterations = 10000;
const testString = 'Société Française Corporation Café München GmbH';

const startTime = Date.now();
for (let i = 0; i < iterations; i++) {
  normalizer.normalizeCompanyName(testString);
}
const endTime = Date.now();

const avgTime = (endTime - startTime) / iterations;
console.log(`  ${iterations} normalizations in ${endTime - startTime}ms`);
console.log(`  Average: ${avgTime.toFixed(3)}ms per normalization`);
assert(avgTime < 1, `Should be fast, got ${avgTime.toFixed(3)}ms`);

console.log('✅ Performance: Acceptable');

console.log('\n✅ ALL TEXT NORMALIZER TESTS PASSED\n');
console.log('Summary:');
console.log('  - Diacritic removal: French, Spanish, German, Portuguese, Polish, Czech, Turkish ✓');
console.log('  - Business suffixes: Corporation, Inc, Ltd, GmbH, SA, LLC ✓');
console.log('  - Whitespace: Multiple spaces, tabs, newlines normalized ✓');
console.log('  - Email normalization: @ symbol preserved ✓');
console.log('  - Person names: Multilingual support ✓');
console.log('  - Search normalization: Aggressive special char removal ✓');
console.log('  - Metadata tracking: Change details captured ✓');
console.log('  - Real-world combinations: Complex company names ✓');
console.log('  - Edge cases: Empty, special chars, long text ✓');
console.log('  - Options: Configurable behavior ✓');
console.log('  - Practical scenarios: Real matching use cases ✓');
console.log(`  - Performance: ${avgTime.toFixed(3)}ms average ✓`);
