/**
 * Test Dependency Resolver
 * 
 * Tests graph-based dependency resolution for complex multi-record operations
 */

import { SalesforceAuth } from '../src/auth.js';
import { SalesforceService } from '../src/service.js';
import { getDatabase } from '../src/database.js';
import { MetadataCacheManager } from '../src/cache-manager.js';
import { DependencyResolver, RecordOperation } from '../src/dependency-resolver.js';

async function testDependencyResolver() {
  console.log('🧪 Testing Dependency Resolver...\n');

  try {
    // Initialize
    const auth = new SalesforceAuth();
    const conn = await auth.getConnection();
    const db = getDatabase();
    const cacheManager = new MetadataCacheManager(db, conn);
    const service = new SalesforceService(conn, db);
    const resolver = new DependencyResolver(db, service, cacheManager);

    console.log('✅ Initialized dependency resolver with cache manager\n');
    console.log('='.repeat(80) + '\n');

    // Test 1: Simple dependency chain (Account → Contact)
    console.log('Test 1: Simple dependency chain');
    console.log('  Account → Contact');
    console.log('  Expected: Execute in sequence\n');

    const operations1: RecordOperation[] = [
      {
        type: 'create',
        sobject: 'Contact',
        tempId: '@contact1',
        data: {
          FirstName: 'Jane',
          LastName: 'Smith',
          AccountId: '@acct1', // Depends on @acct1
        },
      },
      {
        type: 'create',
        sobject: 'Account',
        tempId: '@acct1',
        data: {
          Name: 'Acme Corp 1',
          Industry: 'Technology',
        },
      },
    ];

    const result1 = await resolver.executeWithDependencies(operations1);
    console.log('\n📊 Results:');
    console.log(`  Success: ${result1.success}`);
    console.log(`  Duration: ${result1.totalDuration}ms`);
    console.log(`  Operations: ${result1.operations.length}`);
    console.log(`  Execution Plan: ${result1.executionPlan.length} batches`);
    
    for (const batch of result1.executionPlan) {
      console.log(`    Batch ${batch.level}: ${batch.operations.length} ops (parallel: ${batch.canParallelize})`);
      for (const op of batch.operations) {
        console.log(`      - ${op.type} ${op.sobject} (${op.tempId})`);
      }
    }
    
    console.log(`\n  Expected: 2 batches (Account first, then Contact)`);
    console.log(`  Actual: ${result1.executionPlan.length} batches - ${result1.executionPlan.length === 2 ? '✅' : '❌'}`)

    console.log('\n  Created Records:');
    for (const op of result1.operations) {
      console.log(`    ${op.sobject} (${op.tempId}): ${op.id} - ${op.success ? '✅' : '❌'}`);
    }

    if (result1.errors.length > 0) {
      console.log('\n  Errors:');
      for (const err of result1.errors) {
        console.log(`    ❌ ${err.message}`);
      }
    }

    console.log('\n' + '='.repeat(80) + '\n');

    // Test 2: Parallel operations (multiple independent accounts)
    console.log('Test 2: Parallel operations');
    console.log('  Account1, Account2, Account3 (no dependencies)');
    console.log('  Expected: Execute in parallel\n');

    const operations2: RecordOperation[] = [
      {
        type: 'create',
        sobject: 'Account',
        tempId: '@acct2_1',
        data: {
          Name: 'Parallel Account 1',
          Industry: 'Finance',
        },
      },
      {
        type: 'create',
        sobject: 'Account',
        tempId: '@acct2_2',
        data: {
          Name: 'Parallel Account 2',
          Industry: 'Healthcare',
        },
      },
      {
        type: 'create',
        sobject: 'Account',
        tempId: '@acct2_3',
        data: {
          Name: 'Parallel Account 3',
          Industry: 'Retail',
        },
      },
    ];

    const result2 = await resolver.executeWithDependencies(operations2);
    console.log('\n📊 Results:');
    console.log(`  Success: ${result2.success}`);
    console.log(`  Duration: ${result2.totalDuration}ms`);
    console.log(`  Execution Plan: ${result2.executionPlan.length} batches`);
    
    for (const batch of result2.executionPlan) {
      console.log(`    Batch ${batch.level}: ${batch.operations.length} ops (parallel: ${batch.canParallelize})`);
    }

    console.log('\n' + '='.repeat(80) + '\n');

    // Test 3: Complex multi-level dependencies
    console.log('Test 3: Complex multi-level dependencies');
    console.log('  Account → [Contact1, Contact2, Contact3]');
    console.log('  Expected: Account first, then 3 Contacts in parallel\n');

    const operations3: RecordOperation[] = [
      // Level 0: Account
      {
        type: 'create',
        sobject: 'Account',
        tempId: '@acct3',
        data: {
          Name: 'Complex Account',
          Industry: 'Technology',
        },
      },
      // Level 1: Contacts (parallel)
      {
        type: 'create',
        sobject: 'Contact',
        tempId: '@contact3_1',
        data: {
          FirstName: 'John',
          LastName: 'Doe',
          AccountId: '@acct3',
        },
      },
      {
        type: 'create',
        sobject: 'Contact',
        tempId: '@contact3_2',
        data: {
          FirstName: 'Alice',
          LastName: 'Johnson',
          AccountId: '@acct3',
        },
      },
      {
        type: 'create',
        sobject: 'Contact',
        tempId: '@contact3_3',
        data: {
          FirstName: 'Bob',
          LastName: 'Williams',
          AccountId: '@acct3',
        },
      },
    ];

    const result3 = await resolver.executeWithDependencies(operations3);
    console.log('\n📊 Results:');
    console.log(`  Success: ${result3.success}`);
    console.log(`  Duration: ${result3.totalDuration}ms`);
    console.log(`  Execution Plan: ${result3.executionPlan.length} batches`);
    
    for (const batch of result3.executionPlan) {
      console.log(`    Batch ${batch.level}: ${batch.operations.length} ops (parallel: ${batch.canParallelize})`);
      for (const op of batch.operations) {
        console.log(`      - ${op.sobject} (${op.tempId})`);
      }
    }
    
    console.log(`\n  Expected: 2 batches (1 Account, then 3 Contacts in parallel)`);
    console.log(`  Actual: ${result3.executionPlan.length} batches - ${result3.executionPlan.length === 2 ? '✅' : '❌'}`);
    console.log(`  Batch 1 parallelization: ${result3.executionPlan[1]?.canParallelize ? '✅' : '❌'} (should be true)`);

    console.log('\n  Created Records:');
    for (const op of result3.operations) {
      console.log(`    ${op.sobject} (${op.tempId}): ${op.id} - ${op.success ? '✅' : '❌'}`);
    }

    if (result3.errors.length > 0) {
      console.log('\n  Errors:');
      for (const err of result3.errors) {
        console.log(`    ❌ ${err.message}`);
      }
    }

    console.log('\n' + '='.repeat(80) + '\n');

    // Summary
    console.log('📊 Test Summary:');
    console.log(`Test 1 (Chain): ${result1.success ? '✅ PASSED' : '❌ FAILED'} - ${result1.executionPlan.length} batches`);
    console.log(`Test 2 (Parallel): ${result2.success ? '✅ PASSED' : '❌ FAILED'} - ${result2.executionPlan.length} batch(es)`);
    console.log(`Test 3 (Complex): ${result3.success ? '✅ PASSED' : '❌ FAILED'} - ${result3.executionPlan.length} batches`);
    
    const allPassed = result1.success && result2.success && result3.success;
    console.log(`\n${allPassed ? '✅' : '❌'} Overall: ${allPassed ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}`);

  } catch (error) {
    console.error('❌ Error during dependency resolver test:', error);
    process.exit(1);
  }
}

testDependencyResolver();
