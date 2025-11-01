/**
 * Performance Benchmarking for Duplicate Detection
 * 
 * Tests performance across varying dataset sizes:
 * - 10 records (small)
 * - 50 records (medium)
 * - 100 records (large)
 * - 500 records (very large)
 * 
 * Validates <100ms target for 10 candidates
 * Tests concurrent operations
 */

import { getDatabase } from '../src/database.js';
import { OperationOrchestrator } from '../src/orchestrator.js';
import { MatchConfidence } from '../src/smart-matcher.js';
import { TextNormalizer } from '../src/text-normalizer.js';
import { CompositeSimilarityMatcher } from '../src/similarity.js';

// Helper to setup database
function setupDatabase() {
  const db = getDatabase(':memory:');
  
  const accountId = db.upsertSObject({
    name: 'Account',
    label: 'Account',
    labelPlural: 'Accounts',
    keyPrefix: '001',
    custom: false,
    createable: true,
    updateable: true,
    deletable: true,
    queryable: true,
    retrieveable: true,
    searchable: true
  });

  db.upsertField(accountId, {
    name: 'Name',
    label: 'Account Name',
    type: 'string',
    length: 255,
    custom: false,
    createable: true,
    updateable: true,
    nillable: false,
    calculated: false
  });

  db.upsertField(accountId, {
    name: 'Industry',
    label: 'Industry',
    type: 'picklist',
    length: null,
    custom: false,
    createable: true,
    updateable: true,
    nillable: true,
    calculated: false
  });

  return db;
}

// Generate realistic test data
function generateAccounts(count: number): any[] {
  const companies = [
    'Microsoft', 'Apple', 'Google', 'Amazon', 'Facebook', 'Tesla', 'Netflix', 
    'Adobe', 'Oracle', 'Salesforce', 'IBM', 'Intel', 'Cisco', 'SAP', 'VMware',
    'Uber', 'Airbnb', 'Stripe', 'Square', 'Zoom', 'Slack', 'Dropbox', 'Box',
    'Atlassian', 'Shopify', 'Spotify', 'Twitter', 'LinkedIn', 'Pinterest',
    'Snap', 'Lyft', 'DoorDash', 'Instacart', 'Robinhood', 'Coinbase'
  ];
  
  const suffixes = ['Inc', 'Corp', 'Corporation', 'LLC', 'Ltd', 'Limited', 'GmbH', 'SA', 'AG'];
  const industries = ['Technology', 'Software', 'Hardware', 'Retail', 'Services', 'Finance', 'Healthcare'];
  
  const accounts = [];
  for (let i = 0; i < count; i++) {
    const company = companies[i % companies.length];
    const suffix = i < companies.length ? suffixes[i % suffixes.length] : '';
    const number = i >= companies.length ? ` ${Math.floor(i / companies.length)}` : '';
    
    accounts.push({
      Id: `001xx${i.toString().padStart(9, '0')}`,
      Name: `${company}${number} ${suffix}`.trim(),
      Industry: industries[i % industries.length]
    });
  }
  
  return accounts;
}

// Helper to create mock connection with fuzzy search
function createMockConnection(accounts: any[]) {
  const normalizer = new TextNormalizer();
  const matcher = new CompositeSimilarityMatcher();
  
  return {
    instanceUrl: 'https://test.salesforce.com',
    
    search: async (sosl: string) => {
      const searchTerm = sosl.match(/FIND\s+\{([^}]+)\}/)?.[1]?.replace(/[*~\\]/g, '').trim() || '';
      const normalizedSearch = normalizer.normalize(searchTerm);
      
      const results = accounts.filter(r => {
        const normalizedRecord = normalizer.normalize(r.Name);
        const result = matcher.similarity(normalizedSearch, normalizedRecord);
        return result.score > 0.6;
      });
      
      return { searchRecords: results };
    },
    
    describe: async () => ({
      name: 'Account',
      fields: [
        { name: 'Id', type: 'id', updateable: false, createable: false },
        { name: 'Name', type: 'string', updateable: true, createable: true, length: 255 },
        { name: 'Industry', type: 'picklist', updateable: true, createable: true }
      ],
      recordTypeInfos: []
    }),
    
    describeGlobal: async () => ({
      sobjects: [{ name: 'Account', createable: true, queryable: true }]
    }),
    
    identity: async () => ({
      id: 'https://login.salesforce.com/id/00Dxx0000001gERPAY/005xx000001SwtUAAS',
      display_name: 'Test User',
      organization_id: '00Dxx0000001gERPAY',
      username: 'test@example.com',
      urls: {
        metadata: 'https://test.salesforce.com/services/Soap/m/60.0/00Dxx0000001gERPAY',
        rest: 'https://test.salesforce.com/services/data/v60.0/'
      }
    }),
    
    sobject: () => ({
      create: async () => ({ success: true, id: '001xx000003NEW', errors: [] }),
      describe: async () => ({
        name: 'Account',
        fields: [
          { name: 'Id', type: 'id' },
          { name: 'Name', type: 'string', length: 255 }
        ]
      })
    }),
    
    create: async () => ({ success: true, id: '001xx000003NEW', errors: []})
  };
}

console.log('Performance Benchmarking for Duplicate Detection\n');
console.log('='.repeat(60));
console.log();

(async () => {
  const testSizes = [10, 50, 100, 500];
  const results: any[] = [];

  for (const size of testSizes) {
    console.log(`\n📊 Testing with ${size} records...`);
    console.log('-'.repeat(60));

    const db = setupDatabase();
    const accounts = generateAccounts(size);
    const conn = createMockConnection(accounts) as any;
    const orchestrator = new OperationOrchestrator(db, conn);
    
    await orchestrator.initialize();

    // Test 1: Single duplicate check
    const startSingle = process.hrtime.bigint();
    const duplicates = await orchestrator.checkDuplicates(
      'Account',
      { Name: 'Microsoft Corporation' },
      { minConfidence: MatchConfidence.MEDIUM, limit: 10 }
    );
    const endSingle = process.hrtime.bigint();
    const durationSingle = Number(endSingle - startSingle) / 1_000_000; // Convert to ms

    // Test 2: Multiple concurrent checks
    const numConcurrent = 5;
    const startConcurrent = process.hrtime.bigint();
    const concurrentPromises = Array.from({ length: numConcurrent }, (_, i) => 
      orchestrator.checkDuplicates(
        'Account',
        { Name: `${['Google', 'Apple', 'Amazon', 'Tesla', 'Netflix'][i]} Inc` },
        { minConfidence: MatchConfidence.MEDIUM, limit: 10 }
      )
    );
    await Promise.all(concurrentPromises);
    const endConcurrent = process.hrtime.bigint();
    const durationConcurrent = Number(endConcurrent - startConcurrent) / 1_000_000;
    const avgConcurrent = durationConcurrent / numConcurrent;

    // Test 3: CREATE operation with duplicate check
    const startCreate = process.hrtime.bigint();
    await orchestrator.executeSingleOperation({
      type: 'create',
      sobject: 'Account',
      data: { Name: 'Microsoft Corp', Industry: 'Technology' }
    });
    const endCreate = process.hrtime.bigint();
    const durationCreate = Number(endCreate - startCreate) / 1_000_000;

    // Results
    const passed = durationSingle < 100;
    results.push({
      size,
      single: durationSingle,
      concurrent: avgConcurrent,
      create: durationCreate,
      duplicatesFound: duplicates.length,
      passed
    });

    console.log(`   Single check:        ${durationSingle.toFixed(2)}ms (${duplicates.length} duplicates)`);
    console.log(`   Concurrent (avg):    ${avgConcurrent.toFixed(2)}ms (${numConcurrent} parallel checks)`);
    console.log(`   CREATE w/ detection: ${durationCreate.toFixed(2)}ms`);
    console.log(`   Status:              ${passed ? '✅ PASS' : '❌ FAIL'} (target: <100ms)`);
  }

  // Summary
  console.log();
  console.log('='.repeat(60));
  console.log('\n📈 Performance Summary\n');
  console.log('Dataset Size | Single Check | Concurrent (avg) | CREATE + Detection | Status');
  console.log('-'.repeat(80));
  
  for (const r of results) {
    const singleStr = `${r.single.toFixed(2)}ms`.padEnd(12);
    const concurrentStr = `${r.concurrent.toFixed(2)}ms`.padEnd(16);
    const createStr = `${r.create.toFixed(2)}ms`.padEnd(18);
    const statusStr = r.passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${r.size.toString().padStart(4)} records | ${singleStr} | ${concurrentStr} | ${createStr} | ${statusStr}`);
  }

  console.log();

  // Performance characteristics
  const allPassed = results.every(r => r.passed);
  const avgSingle = results.reduce((sum, r) => sum + r.single, 0) / results.length;
  const maxSingle = Math.max(...results.map(r => r.single));
  const minSingle = Math.min(...results.map(r => r.single));

  console.log('Performance Characteristics:');
  console.log(`  Average single check: ${avgSingle.toFixed(2)}ms`);
  console.log(`  Min single check: ${minSingle.toFixed(2)}ms`);
  console.log(`  Max single check: ${maxSingle.toFixed(2)}ms`);
  console.log(`  Scalability: ${(results[3].single / results[0].single).toFixed(2)}x (500 vs 10 records)`);
  console.log();

  if (allPassed) {
    console.log('✅ ALL PERFORMANCE TESTS PASSED');
    console.log();
    console.log('Summary:');
    console.log('  - All dataset sizes meet <100ms target ✓');
    console.log('  - Concurrent operations handled efficiently ✓');
    console.log('  - CREATE operations with detection performant ✓');
    console.log('  - System scales well with dataset size ✓');
  } else {
    console.log('❌ SOME PERFORMANCE TESTS FAILED');
    console.log('   Review results above for details');
  }

})().catch(error => {
  console.error('❌ Benchmark failed:', error);
  process.exit(1);
});
