/**
 * INTEGRATION TEST - Full End-to-End Testing
 * 
 * Tests all 4 milestones working together:
 * - Milestone 1: Database Integration
 * - Milestone 2: Metadata Sync
 * - Milestone 3: Pre-flight Validation
 * - Milestone 4A-C: Cache Manager + Resolver + Orchestrator
 */

import { SalesforceAuth } from '../src/auth.js';
import { getDatabase, MetadataDatabase } from '../src/database.js';
import { MetadataSyncService } from '../src/metadata-sync.js';
import { MetadataCacheManager } from '../src/cache-manager.js';
import { DependencyResolver, RecordOperation } from '../src/dependency-resolver.js';
import { PreflightValidator } from '../src/preflight-validator.js';
import { OperationOrchestrator } from '../src/orchestrator.js';
import { SalesforceService } from '../src/service.js';

interface TestResult {
  milestone: string;
  passed: boolean;
  duration: number;
  errors: string[];
  warnings: string[];
}

async function runIntegrationTest() {
  console.log('=' .repeat(80));
  console.log('🧪 FULL INTEGRATION TEST - All 4 Milestones');
  console.log('=' .repeat(80));
  console.log('\n');

  const results: TestResult[] = [];
  const startTime = Date.now();

  try {
    // Setup
    console.log('🔧 Setup: Initializing connections...\n');
    const auth = new SalesforceAuth();
    const conn = await auth.getConnection();
    const db = getDatabase();
    
    console.log('✅ Setup complete\n');
    console.log('=' .repeat(80));
    console.log('\n');

    // =========================================================================
    // MILESTONE 1: Database Integration
    // =========================================================================
    console.log('📦 MILESTONE 1: Database Integration');
    console.log('-'.repeat(80));
    const m1Start = Date.now();
    const m1Errors: string[] = [];
    const m1Warnings: string[] = [];

    try {
      // Test 1.1: Database structure
      console.log('Test 1.1: Verify database schema...');
      const rawDb = db.getDb();
      const tables = rawDb.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
        ORDER BY name
      `).all() as Array<{ name: string }>;
      
      const expectedTables = [
        'fields', 'field_dependencies', 'org_info', 'record_types',
        'relationships', 'sobjects', 'triggers', 'validation_rules'
      ];
      
      const tableNames = tables.map(t => t.name);
      const missingTables = expectedTables.filter(t => !tableNames.includes(t));
      
      if (missingTables.length > 0) {
        m1Errors.push(`Missing tables: ${missingTables.join(', ')}`);
      } else {
        console.log(`  ✅ All 8 tables present: ${tableNames.join(', ')}`);
      }

      // Test 1.2: Indexes
      console.log('Test 1.2: Verify indexes...');
      const indexes = rawDb.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='index' AND name NOT LIKE 'sqlite_%'
      `).all() as Array<{ name: string }>;
      
      if (indexes.length >= 6) {
        console.log(`  ✅ ${indexes.length} indexes created`);
      } else {
        m1Warnings.push(`Only ${indexes.length} indexes found, expected at least 6`);
      }

      // Test 1.3: Migration support
      console.log('Test 1.3: Check migration system...');
      const columnsInfo = rawDb.prepare(`PRAGMA table_info(sobjects)`).all() as Array<{
        name: string;
        type: string;
      }>;
      const hasTimestamps = columnsInfo.some(c => c.name === 'synced_at');
      
      if (hasTimestamps) {
        console.log('  ✅ Migration system working (synced_at column present)');
      } else {
        m1Errors.push('Migration system failed: synced_at column missing');
      }

      // Test 1.4: Query performance
      console.log('Test 1.4: Test query performance...');
      const queryStart = Date.now();
      db.getSObject('Account');
      const queryDuration = Date.now() - queryStart;
      
      if (queryDuration < 100) {
        console.log(`  ✅ Query performance: ${queryDuration}ms (excellent)`);
      } else {
        m1Warnings.push(`Query took ${queryDuration}ms (should be <100ms)`);
      }

      results.push({
        milestone: 'Milestone 1: Database Integration',
        passed: m1Errors.length === 0,
        duration: Date.now() - m1Start,
        errors: m1Errors,
        warnings: m1Warnings
      });

      console.log(`\n${m1Errors.length === 0 ? '✅' : '❌'} Milestone 1: ${m1Errors.length === 0 ? 'PASSED' : 'FAILED'}`);
      if (m1Errors.length > 0) m1Errors.forEach(e => console.log(`  ❌ ${e}`));
      if (m1Warnings.length > 0) m1Warnings.forEach(w => console.log(`  ⚠️  ${w}`));
      
    } catch (error) {
      m1Errors.push(`Exception: ${error}`);
      results.push({
        milestone: 'Milestone 1: Database Integration',
        passed: false,
        duration: Date.now() - m1Start,
        errors: m1Errors,
        warnings: m1Warnings
      });
      console.log('❌ Milestone 1: FAILED');
    }

    console.log('\n' + '='.repeat(80) + '\n');

    // =========================================================================
    // MILESTONE 2: Metadata Sync
    // =========================================================================
    console.log('🔄 MILESTONE 2: Metadata Sync Engine');
    console.log('-'.repeat(80));
    const m2Start = Date.now();
    const m2Errors: string[] = [];
    const m2Warnings: string[] = [];

    try {
      const syncService = new MetadataSyncService(conn, db);

      // Test 2.1: Sync core objects
      console.log('Test 2.1: Sync core objects (Account, Contact)...');
      const syncResult = await syncService.syncObjects(['Account', 'Contact']);
      
      if (syncResult.objectsSynced >= 2) {
        console.log(`  ✅ Synced ${syncResult.objectsSynced} objects successfully`);
      } else {
        m2Errors.push(`Only synced ${syncResult.objectsSynced} out of 2 objects`);
      }

      // Test 2.2: Verify synced data
      console.log('Test 2.2: Verify synced metadata...');
      const accountMeta = db.getSObject('Account');
      const contactMeta = db.getSObject('Contact');
      
      if (accountMeta && contactMeta) {
        const accountFields = db.getFields('Account');
        const contactFields = db.getFields('Contact');
        console.log(`  ✅ Account: ${accountFields.length} fields`);
        console.log(`  ✅ Contact: ${contactFields.length} fields`);
      } else {
        m2Errors.push('Failed to retrieve synced metadata');
      }

      // Test 2.3: Relationships
      console.log('Test 2.3: Check relationships...');
      const accountRels = db.getRelationships('Account');
      const contactRels = db.getRelationships('Contact');
      
      if (accountRels.length > 0 && contactRels.length > 0) {
        console.log(`  ✅ Account: ${accountRels.length} relationships`);
        console.log(`  ✅ Contact: ${contactRels.length} relationships`);
      } else {
        m2Warnings.push('No relationships found for core objects');
      }

      // Test 2.4: Sync statistics
      console.log('Test 2.4: Verify sync statistics...');
      const stats = db.getStats();
      
      if (stats.sobject_count >= 2) {
        console.log(`  ✅ Database stats: ${stats.sobject_count} objects, ${stats.field_count} fields`);
      } else {
        m2Warnings.push('Sync statistics incomplete');
      }

      results.push({
        milestone: 'Milestone 2: Metadata Sync Engine',
        passed: m2Errors.length === 0,
        duration: Date.now() - m2Start,
        errors: m2Errors,
        warnings: m2Warnings
      });

      console.log(`\n${m2Errors.length === 0 ? '✅' : '❌'} Milestone 2: ${m2Errors.length === 0 ? 'PASSED' : 'FAILED'}`);
      if (m2Errors.length > 0) m2Errors.forEach(e => console.log(`  ❌ ${e}`));
      if (m2Warnings.length > 0) m2Warnings.forEach(w => console.log(`  ⚠️  ${w}`));

    } catch (error) {
      m2Errors.push(`Exception: ${error}`);
      results.push({
        milestone: 'Milestone 2: Metadata Sync Engine',
        passed: false,
        duration: Date.now() - m2Start,
        errors: m2Errors,
        warnings: m2Warnings
      });
      console.log('❌ Milestone 2: FAILED');
    }

    console.log('\n' + '='.repeat(80) + '\n');

    // =========================================================================
    // MILESTONE 3: Pre-flight Validation
    // =========================================================================
    console.log('✅ MILESTONE 3: Pre-flight Validation Layer');
    console.log('-'.repeat(80));
    const m3Start = Date.now();
    const m3Errors: string[] = [];
    const m3Warnings: string[] = [];

    try {
      const validator = new PreflightValidator(db);

      // Test 3.1: Required fields validation
      console.log('Test 3.1: Required fields validation...');
      const result1 = await validator.validateCreate('Account', { Industry: 'Technology' });
      
      if (!result1.valid && result1.errors.some(e => e.field === 'Name' || e.message.includes('Name'))) {
        console.log('  ✅ Required field validation working');
      } else {
        m3Errors.push('Required field validation not working correctly');
        console.log(`  Debug: valid=${result1.valid}, errors=${JSON.stringify(result1.errors)}`);
      }

      // Test 3.2: Field type validation
      console.log('Test 3.2: Field type validation...');
      const result2 = await validator.validateCreate('Account', { 
        Name: 'Test',
        NumberOfEmployees: 'not-a-number' as any
      });
      
      if (result2.errors.some(e => e.field === 'NumberOfEmployees')) {
        console.log('  ✅ Field type validation working');
      } else {
        m3Warnings.push('Field type validation may not be working');
      }

      // Test 3.3: Picklist validation
      console.log('Test 3.3: Picklist value validation...');
      const result3 = await validator.validateCreate('Account', { 
        Name: 'Test',
        Industry: 'InvalidIndustry123'
      });
      
      if (result3.warnings.length > 0 || result3.suggestions.length > 0) {
        console.log('  ✅ Picklist validation working');
      } else {
        m3Warnings.push('Picklist validation may not be detecting invalid values');
      }

      // Test 3.4: Relationship validation
      console.log('Test 3.4: Relationship field validation...');
      const result4 = await validator.validateCreate('Contact', { 
        FirstName: 'John',
        LastName: 'Doe',
        AccountId: '001invalid'
      });
      
      if (result4.suggestions.some(s => s.field === 'AccountId' || s.message.includes('AccountId'))) {
        console.log('  ✅ Relationship validation working');
      } else {
        m3Warnings.push('Relationship validation not generating suggestions');
      }

      results.push({
        milestone: 'Milestone 3: Pre-flight Validation Layer',
        passed: m3Errors.length === 0,
        duration: Date.now() - m3Start,
        errors: m3Errors,
        warnings: m3Warnings
      });

      console.log(`\n${m3Errors.length === 0 ? '✅' : '❌'} Milestone 3: ${m3Errors.length === 0 ? 'PASSED' : 'FAILED'}`);
      if (m3Errors.length > 0) m3Errors.forEach(e => console.log(`  ❌ ${e}`));
      if (m3Warnings.length > 0) m3Warnings.forEach(w => console.log(`  ⚠️  ${w}`));

    } catch (error) {
      m3Errors.push(`Exception: ${error}`);
      results.push({
        milestone: 'Milestone 3: Pre-flight Validation Layer',
        passed: false,
        duration: Date.now() - m3Start,
        errors: m3Errors,
        warnings: m3Warnings
      });
      console.log('❌ Milestone 3: FAILED');
    }

    console.log('\n' + '='.repeat(80) + '\n');

    // =========================================================================
    // MILESTONE 4: Cache Manager + Resolver + Orchestrator
    // =========================================================================
    console.log('🕷️ MILESTONE 4: Intelligent Processing (Cache + Resolver + Orchestrator)');
    console.log('-'.repeat(80));
    const m4Start = Date.now();
    const m4Errors: string[] = [];
    const m4Warnings: string[] = [];

    try {
      // Test 4A: Cache Manager
      console.log('Test 4A: Cache Manager...');
      const cacheManager = new MetadataCacheManager(db, conn);
      await cacheManager.initialize();
      
      const stats = cacheManager.getCacheStats();
      if (stats.coreObjectsCached === 6) {
        console.log(`  ✅ Cache initialized: ${stats.totalObjects} objects, ${stats.totalFields} fields`);
      } else {
        m4Errors.push(`Cache initialization incomplete: ${stats.coreObjectsCached}/6 core objects`);
      }

      // Test lazy loading
      console.log('  Testing lazy-loading...');
      await cacheManager.ensureMetadata(['Lead', 'Opportunity']);
      const stats2 = cacheManager.getCacheStats();
      
      if (stats2.totalObjects >= 8) {
        console.log(`  ✅ Lazy-loading working: ${stats2.totalObjects} objects cached`);
      } else {
        m4Warnings.push('Lazy-loading may not be working correctly');
      }

      // Test 4B: Dependency Resolver
      console.log('Test 4B: Dependency Resolver...');
      const service = new SalesforceService(conn, db);
      const resolver = new DependencyResolver(db, service, cacheManager);

      const operations: RecordOperation[] = [
        {
          type: 'create',
          sobject: 'Account',
          tempId: '@test_acc',
          data: { Name: 'Integration Test Account' }
        },
        {
          type: 'create',
          sobject: 'Contact',
          tempId: '@test_contact',
          data: {
            FirstName: 'Integration',
            LastName: 'Test',
            AccountId: '@test_acc'
          }
        }
      ];

      const resolverResult = await resolver.executeWithDependencies(operations);
      
      if (resolverResult.executionPlan.length === 2) {
        console.log(`  ✅ Dependency resolution: ${resolverResult.executionPlan.length} batches created`);
        console.log(`  ✅ Successful operations: ${resolverResult.operations.filter(op => op.success).length}`);
      } else {
        m4Errors.push(`Expected 2 batches, got ${resolverResult.executionPlan.length}`);
      }

      // Test 4C: Orchestrator
      console.log('Test 4C: Operation Orchestrator...');
      const orchestrator = new OperationOrchestrator(db, conn);
      await orchestrator.initialize();

      // Test single operation
      console.log('  Testing single operation...');
      const singleResult = await orchestrator.execute({
        type: 'create',
        sobject: 'Account',
        data: { Name: 'Orchestrator Integration Test' }
      });

      if (singleResult.type === 'single' && singleResult.result.success) {
        console.log('  ✅ Single operation successful');
      } else {
        m4Warnings.push('Single operation through orchestrator failed');
      }

      // Test multi-operation
      console.log('  Testing multi-operation...');
      const multiOps: RecordOperation[] = [
        {
          type: 'create',
          sobject: 'Account',
          tempId: '@orch_acc',
          data: { Name: 'Multi-Op Test' }
        },
        {
          type: 'create',
          sobject: 'Contact',
          tempId: '@orch_contact',
          data: {
            FirstName: 'Multi',
            LastName: 'Test',
            AccountId: '@orch_acc'
          }
        }
      ];

      const multiResult = await orchestrator.execute(multiOps);
      
      if (multiResult.type === 'multi') {
        const res = multiResult.result as import('../src/orchestrator.js').MultiOperationResult;
        console.log(`  ✅ Multi-operation: ${res.successfulOperations}/${res.totalOperations} successful`);
        console.log(`  ✅ Execution plan: ${res.executionPlan.length} batches`);
      } else {
        m4Errors.push('Multi-operation routing failed');
      }

      results.push({
        milestone: 'Milestone 4: Intelligent Processing',
        passed: m4Errors.length === 0,
        duration: Date.now() - m4Start,
        errors: m4Errors,
        warnings: m4Warnings
      });

      console.log(`\n${m4Errors.length === 0 ? '✅' : '❌'} Milestone 4: ${m4Errors.length === 0 ? 'PASSED' : 'FAILED'}`);
      if (m4Errors.length > 0) m4Errors.forEach(e => console.log(`  ❌ ${e}`));
      if (m4Warnings.length > 0) m4Warnings.forEach(w => console.log(`  ⚠️  ${w}`));

    } catch (error) {
      m4Errors.push(`Exception: ${error}`);
      results.push({
        milestone: 'Milestone 4: Intelligent Processing',
        passed: false,
        duration: Date.now() - m4Start,
        errors: m4Errors,
        warnings: m4Warnings
      });
      console.log('❌ Milestone 4: FAILED');
    }

    // =========================================================================
    // FINAL SUMMARY
    // =========================================================================
    console.log('\n' + '='.repeat(80));
    console.log('📊 INTEGRATION TEST SUMMARY');
    console.log('='.repeat(80));
    console.log('\n');

    const totalDuration = Date.now() - startTime;
    const passedCount = results.filter(r => r.passed).length;
    const totalCount = results.length;

    results.forEach((result, index) => {
      const icon = result.passed ? '✅' : '❌';
      console.log(`${icon} ${result.milestone}`);
      console.log(`   Duration: ${result.duration}ms`);
      if (result.errors.length > 0) {
        console.log(`   Errors: ${result.errors.length}`);
        result.errors.forEach(e => console.log(`     - ${e}`));
      }
      if (result.warnings.length > 0) {
        console.log(`   Warnings: ${result.warnings.length}`);
        result.warnings.forEach(w => console.log(`     - ${w}`));
      }
      console.log('');
    });

    console.log('='.repeat(80));
    console.log(`\n🎯 Overall Result: ${passedCount}/${totalCount} milestones PASSED`);
    console.log(`⏱️  Total Duration: ${totalDuration}ms (${(totalDuration / 1000).toFixed(2)}s)`);
    
    const allPassed = passedCount === totalCount;
    console.log(`\n${allPassed ? '🎉 ALL TESTS PASSED!' : '⚠️  SOME TESTS FAILED'}`);
    console.log('='.repeat(80));

    process.exit(allPassed ? 0 : 1);

  } catch (error) {
    console.error('\n❌ FATAL ERROR:', error);
    process.exit(1);
  }
}

runIntegrationTest();
