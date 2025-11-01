import { getDatabase } from '../src/database.js';

async function testDatabase() {
  console.log('🧪 Testing SQLite Database Setup...\n');

  try {
    // Initialize database
    const db = getDatabase();
    console.log('✅ Database initialized successfully');
    console.log(`📁 Database location: ${db.getDbPath()}\n`);

    // Test org info
    console.log('📊 Testing org info operations...');
    db.updateOrgInfo('00D000000000001', 'https://test.salesforce.com', 'Test Org');
    const orgInfo = db.getOrgInfo();
    console.log('✅ Org info stored:', orgInfo);
    console.log();

    // Test SObject operations
    console.log('📋 Testing SObject operations...');
    const accountId = db.upsertSObject({
      name: 'Account',
      label: 'Account',
      labelPlural: 'Accounts',
      keyPrefix: '001',
      custom: false,
      queryable: true,
      createable: true,
      updateable: true,
      deletable: true,
      retrieveable: true,
      searchable: true,
    });
    console.log(`✅ Account SObject inserted with ID: ${accountId}`);

    const contactId = db.upsertSObject({
      name: 'Contact',
      label: 'Contact',
      labelPlural: 'Contacts',
      keyPrefix: '003',
      custom: false,
      queryable: true,
      createable: true,
      updateable: true,
      deletable: true,
      retrieveable: true,
      searchable: true,
    });
    console.log(`✅ Contact SObject inserted with ID: ${contactId}`);
    console.log();

    // Test field operations
    console.log('🔤 Testing field operations...');
    db.upsertField(accountId, {
      name: 'Name',
      label: 'Account Name',
      type: 'string',
      length: 255,
      nillable: false, // Required field
      unique: false,
      externalId: false,
      autoNumber: false,
      calculated: false,
    });
    console.log('✅ Name field inserted');

    db.upsertField(accountId, {
      name: 'Industry',
      label: 'Industry',
      type: 'picklist',
      nillable: true,
      picklistValues: [
        { label: 'Agriculture', value: 'Agriculture' },
        { label: 'Technology', value: 'Technology' },
        { label: 'Finance', value: 'Finance' },
      ],
    });
    console.log('✅ Industry field inserted');

    db.upsertField(accountId, {
      name: 'AnnualRevenue',
      label: 'Annual Revenue',
      type: 'currency',
      precision: 18,
      scale: 2,
      nillable: true,
    });
    console.log('✅ AnnualRevenue field inserted');

    // Add AccountId field to Contact (for relationship)
    db.upsertField(contactId, {
      name: 'AccountId',
      label: 'Account ID',
      type: 'reference',
      nillable: true,
      referenceTo: ['Account'],
      relationshipName: 'Account',
    });
    console.log('✅ AccountId field inserted on Contact');
    console.log();

    // Test validation rule
    console.log('✔️ Testing validation rule operations...');
    db.upsertValidationRule(accountId, {
      fullName: 'Account_Name_Must_Not_Be_Test',
      active: true,
      errorMessage: 'Account name cannot contain "Test"',
      errorDisplayField: 'Name',
      errorConditionFormula: 'CONTAINS(Name, "Test")',
      description: 'Prevents accounts with Test in the name',
    });
    console.log('✅ Validation rule inserted');
    console.log();

    // Query required fields
    console.log('🔍 Testing queries...');
    const requiredFields = db.getRequiredFields('Account');
    console.log(`✅ Required fields for Account: ${requiredFields.length} found`);
    requiredFields.forEach(f => console.log(`   - ${f.name} (${f.type})`));
    console.log();

    // Query validation rules
    const validationRules = db.getValidationRules('Account');
    console.log(`✅ Active validation rules for Account: ${validationRules.length} found`);
    validationRules.forEach(r => console.log(`   - ${r.name}: ${r.error_message}`));
    console.log();

    // Get statistics
    console.log('📈 Database Statistics:');
    const stats = db.getStats();
    console.log(`   - SObjects: ${stats.sobjects.count}`);
    console.log(`   - Fields: ${stats.fields.count}`);
    console.log(`   - Validation Rules: ${stats.validationRules.count}`);
    console.log(`   - Relationships: ${stats.relationships.count}`);
    console.log(`   - Last Synced: ${stats.orgInfo?.last_synced_at || 'Never'}`);
    console.log();

    console.log('✅ All database tests passed!');
    console.log('🎉 Milestone 1: SQLite Integration & Setup - COMPLETE\n');

  } catch (error) {
    console.error('❌ Database test failed:', error);
    process.exit(1);
  }
}

testDatabase();
