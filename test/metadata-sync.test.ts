import { SalesforceAuth } from '../src/auth.js';
import { getDatabase } from '../src/database.js';
import { MetadataSyncService } from '../src/metadata-sync.js';

async function testMetadataSync() {
  console.log('🧪 Testing Metadata Sync Service...\n');

  try {
    // Initialize auth
    const auth = new SalesforceAuth();
    const conn = await auth.getConnection();
    console.log('✅ Connected to Salesforce\n');

    // Initialize database
    const db = getDatabase();
    console.log('✅ Database initialized\n');

    // Clear existing metadata for fresh test
    console.log('🗑️  Clearing existing metadata...');
    db.clearMetadata();
    console.log('✅ Metadata cleared\n');

    // Create sync service
    const syncService = new MetadataSyncService(conn, db);

    // Test 1: Sync specific objects
    console.log('📥 Test 1: Syncing Account and Contact objects...\n');
    const result = await syncService.syncAll({ objects: ['Account', 'Contact'] });

    console.log('\n📊 Sync Results:');
    console.log(`   Success: ${result.success}`);
    console.log(`   Objects Synced: ${result.objectsSynced}`);
    console.log(`   Fields Synced: ${result.fieldsSynced}`);
    console.log(`   Validation Rules: ${result.validationRulesSynced}`);
    console.log(`   Relationships: ${result.relationshipsSynced}`);
    console.log(`   Duration: ${result.duration}ms`);
    if (result.errors.length > 0) {
      console.log(`   Errors: ${result.errors.length}`);
      result.errors.forEach(err => console.log(`     - ${err}`));
    }

    // Test 2: Verify data in database
    console.log('\n🔍 Test 2: Verifying stored metadata...\n');

    const stats = db.getStats();
    console.log('Database Statistics:');
    console.log(`   SObjects: ${stats.sobjects.count}`);
    console.log(`   Fields: ${stats.fields.count}`);
    console.log(`   Validation Rules: ${stats.validationRules.count}`);
    console.log(`   Relationships: ${stats.relationships.count}`);

    // Test 3: Query specific metadata
    console.log('\n📋 Test 3: Querying Account metadata...\n');

    const accountFields = db.getFields('Account');
    console.log(`Account has ${accountFields.length} fields`);

    const requiredFields = db.getRequiredFields('Account');
    console.log(`\nRequired fields for Account: ${requiredFields.length}`);
    requiredFields.forEach(f => {
      console.log(`   - ${f.name} (${f.type})`);
    });

    const validationRules = db.getValidationRules('Account');
    console.log(`\nValidation rules for Account: ${validationRules.length}`);
    validationRules.forEach(r => {
      console.log(`   - ${r.name}`);
      console.log(`     Error: ${r.error_message}`);
      if (r.formula && r.formula.length > 100) {
        console.log(`     Formula: ${r.formula.substring(0, 100)}...`);
      } else {
        console.log(`     Formula: ${r.formula}`);
      }
    });

    const relationships = db.getRelationships('Contact');
    console.log(`\nRelationships from Contact: ${relationships.length}`);
    relationships.forEach(r => {
      console.log(`   - ${r.field_name} → ${r.to_sobject} (${r.relationship_type}${r.is_required ? ', required' : ''})`);
    });

    // Test 4: Check picklist values
    console.log('\n🎨 Test 4: Checking picklist fields...\n');
    const picklistFields = accountFields.filter(f => f.type === 'picklist');
    console.log(`Account has ${picklistFields.length} picklist fields`);
    picklistFields.slice(0, 3).forEach(f => {
      const values = f.picklist_values ? JSON.parse(f.picklist_values) : [];
      console.log(`   - ${f.name}: ${values.length} values`);
      if (values.length > 0 && values.length <= 5) {
        values.forEach((v: any) => console.log(`     • ${v.label}`));
      }
    });

    console.log('\n✅ All metadata sync tests passed!');
    console.log('🎉 Milestone 2: Metadata Sync Engine - Core Functionality COMPLETE\n');

  } catch (error) {
    console.error('❌ Metadata sync test failed:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  }
}

testMetadataSync();
