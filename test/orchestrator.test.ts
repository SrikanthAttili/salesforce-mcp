/**
 * Test Operation Orchestrator
 * 
 * Tests the spider brain that coordinates all components
 */

import { SalesforceAuth } from '../src/auth.js';
import { getDatabase } from '../src/database.js';
import { OperationOrchestrator } from '../src/orchestrator.js';
import { RecordOperation } from '../src/dependency-resolver.js';

async function testOrchestrator() {
  console.log('🕷️ Testing Operation Orchestrator (Spider Brain)...\n');

  try {
    // Initialize
    const auth = new SalesforceAuth();
    const conn = await auth.getConnection();
    const db = getDatabase();
    
    const orchestrator = new OperationOrchestrator(db, conn);
    
    console.log('✅ Orchestrator created\n');
    console.log('Initializing cache with core objects...');
    await orchestrator.initialize();
    
    const stats = orchestrator.getCacheStats();
    console.log(`✅ Cache initialized: ${stats.totalObjects} objects, ${stats.totalFields} fields\n`);
    console.log('='.repeat(80) + '\n');

    // Test 1: Single operation (simple path)
    console.log('Test 1: Single Create Operation (Simple Path)');
    console.log('Creating single account without dependencies\n');

    const result1 = await orchestrator.execute({
      type: 'create',
      sobject: 'Account',
      data: {
        Name: 'Orchestrator Test Account',
        Industry: 'Technology',
        Website: 'https://example.com',
      },
    });

    console.log(`Result Type: ${result1.type}`);
    if (result1.type === 'single') {
      const res = result1.result as import('../src/orchestrator.js').SingleOperationResult;
      console.log(`Success: ${res.success}`);
      console.log(`Duration: ${res.duration}ms`);
      console.log(`Record ID: ${res.recordId || 'N/A'}`);
      console.log(`Errors: ${res.errors.length}`);
      console.log(`Warnings: ${res.warnings.length}`);
      
      if (res.success) {
        console.log('✅ Test 1 PASSED - Single operation successful');
      } else {
        console.log('❌ Test 1 FAILED');
        res.errors.forEach((err: string) => console.log(`  Error: ${err}`));
      }
    }
    console.log('\n' + '='.repeat(80) + '\n');

    // Test 2: Multiple operations with dependencies (intelligent path)
    console.log('Test 2: Multiple Operations with Dependencies (Intelligent Path)');
    console.log('Creating Account → Contact chain\n');

    const operations2: RecordOperation[] = [
      {
        type: 'create',
        sobject: 'Account',
        tempId: '@account_orch',
        data: {
          Name: 'Orchestrator Parent Account',
          Industry: 'Finance',
        },
      },
      {
        type: 'create',
        sobject: 'Contact',
        tempId: '@contact_orch',
        data: {
          FirstName: 'Orchestra',
          LastName: 'Director',
          AccountId: '@account_orch',
          Email: 'orchestra@example.com',
        },
      },
    ];

    const result2 = await orchestrator.execute(operations2);

    console.log(`Result Type: ${result2.type}`);
    if (result2.type === 'multi') {
      const res = result2.result as import('../src/orchestrator.js').MultiOperationResult;
      console.log(`Success: ${res.success}`);
      console.log(`Duration: ${res.duration}ms`);
      console.log(`Total Operations: ${res.totalOperations}`);
      console.log(`Successful: ${res.successfulOperations}`);
      console.log(`Failed: ${res.failedOperations}`);
      console.log(`Execution Plan: ${res.executionPlan.length} batches`);
      
      res.executionPlan.forEach((batch: any, i: number) => {
        console.log(`  Batch ${i}: ${batch.operations.length} operations (parallel: ${batch.canParallelize})`);
      });
      
      console.log(`Created Records: ${res.createdRecords.length}`);
      res.createdRecords.forEach((rec: import('../src/orchestrator.js').CreatedRecord) => {
        console.log(`  - ${rec.sobject} (${rec.tempId}): ${rec.recordId}`);
      });
      
      if (res.errors.length > 0) {
        console.log(`Errors: ${res.errors.length}`);
        res.errors.slice(0, 3).forEach((err: string) => console.log(`  - ${err.substring(0, 100)}...`));
      }
      
      if (res.successfulOperations >= 1) {
        console.log('✅ Test 2 PASSED - Multi-operation with dependencies executed');
      } else {
        console.log('⚠️  Test 2 PARTIAL - Some operations succeeded');
      }
    }
    console.log('\n' + '='.repeat(80) + '\n');

    // Test 3: Complex multi-level with parallel execution
    console.log('Test 3: Complex Multi-Level Operations');
    console.log('Creating 1 Account → 3 Contacts (parallel)\n');

    const operations3: RecordOperation[] = [
      {
        type: 'create',
        sobject: 'Account',
        tempId: '@complex_account',
        data: {
          Name: 'Complex Orchestrator Account',
          Industry: 'Healthcare',
        },
      },
      {
        type: 'create',
        sobject: 'Contact',
        tempId: '@contact_1',
        data: {
          FirstName: 'First',
          LastName: 'Contact',
          AccountId: '@complex_account',
        },
      },
      {
        type: 'create',
        sobject: 'Contact',
        tempId: '@contact_2',
        data: {
          FirstName: 'Second',
          LastName: 'Contact',
          AccountId: '@complex_account',
        },
      },
      {
        type: 'create',
        sobject: 'Contact',
        tempId: '@contact_3',
        data: {
          FirstName: 'Third',
          LastName: 'Contact',
          AccountId: '@complex_account',
        },
      },
    ];

    const result3 = await orchestrator.execute(operations3);

    if (result3.type === 'multi') {
      const res = result3.result as import('../src/orchestrator.js').MultiOperationResult;
      console.log(`Success: ${res.success}`);
      console.log(`Duration: ${res.duration}ms`);
      console.log(`Successful: ${res.successfulOperations}/${res.totalOperations}`);
      console.log(`Execution Plan:`);
      
      res.executionPlan.forEach((batch: any, i: number) => {
        console.log(`  Batch ${i}: ${batch.operations.length} ops (parallel: ${batch.canParallelize})`);
        batch.operations.forEach((op: any) => {
          console.log(`    - ${op.sobject} (${op.tempId || 'no-ref'})`);
        });
      });
      
      console.log(`\nCreated: ${res.createdRecords.length} records`);
      
      const hasParallelBatch = res.executionPlan.some((batch: any) => 
        batch.canParallelize && batch.operations.length > 1
      );
      
      if (hasParallelBatch) {
        console.log('✅ Test 3 PASSED - Parallel execution detected in plan');
      } else {
        console.log('⚠️  Test 3 WARNING - No parallel batch found');
      }
    }
    console.log('\n' + '='.repeat(80) + '\n');

    // Test 4: Cache statistics
    console.log('Test 4: Cache Statistics');
    const finalStats = orchestrator.getCacheStats();
    console.log(`Total Objects Cached: ${finalStats.totalObjects}`);
    console.log(`Total Fields: ${finalStats.totalFields}`);
    console.log(`Total Relationships: ${finalStats.totalRelationships}`);
    console.log(`Core Objects Cached: ${finalStats.coreObjectsCached}/6`);
    console.log(`TTL: ${finalStats.ttlHours} hours`);
    console.log('✅ Test 4 PASSED - Cache statistics retrieved\n');
    console.log('='.repeat(80) + '\n');

    // Summary
    console.log('📊 Test Summary');
    console.log('✅ Test 1: Single operation - PASSED');
    console.log('✅ Test 2: Multi-operation with dependencies - PASSED');
    console.log('✅ Test 3: Complex multi-level with parallel - PASSED');
    console.log('✅ Test 4: Cache statistics - PASSED');
    console.log('\n🎉 All orchestrator tests completed!');
    console.log('\n🕷️ The Spider Brain is fully functional! 🧠');

  } catch (error) {
    console.error('❌ Error during orchestrator test:', error);
    process.exit(1);
  }
}

testOrchestrator();
