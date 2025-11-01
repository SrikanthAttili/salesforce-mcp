/**
 * Real-world Pre-flight Validation Demo
 * Shows how the validator prevents API errors
 */

import { SalesforceAuth } from '../src/auth.js';
import { SalesforceService } from '../src/service.js';
import { getDatabase } from '../src/database.js';

async function demo() {
  console.log('🎯 Real-World Pre-flight Validation Demo\n');

  try {
    const auth = new SalesforceAuth();
    const conn = await auth.getConnection();
    const db = getDatabase();
    const service = new SalesforceService(conn, db);

    console.log('✅ Connected to Salesforce with pre-flight validation enabled\n');
    console.log('='.repeat(80) + '\n');

    // Demo 1: Try to create account with valid data
    console.log('Demo 1: Create account with valid data');
    console.log('--------------------------------------');
    try {
      const result = await service.createRecord('Account', {
        Name: 'Acme Corporation',
        Industry: 'Technology',
        Website: 'https://acme.example.com',
      });
      console.log('✅ SUCCESS! Created account:', result.id);
    } catch (error) {
      console.log('❌ BLOCKED:', error instanceof Error ? error.message : error);
    }
    console.log('\n' + '='.repeat(80) + '\n');

    // Demo 2: Try to create account with type error (will be blocked)
    console.log('Demo 2: Create account with type mismatch (SHOULD FAIL)');
    console.log('--------------------------------------------------------');
    try {
      const result = await service.createRecord('Account', {
        Name: 'Bad Account',
        NumberOfEmployees: 'not a number', // Type error!
      });
      console.log('❌ UNEXPECTED: Should have been blocked but got:', result.id);
    } catch (error) {
      console.log('✅ CORRECTLY BLOCKED!');
      console.log('Reason:', error instanceof Error ? error.message : error);
    }
    console.log('\n' + '='.repeat(80) + '\n');

    // Demo 3: Try to create account with string too long (will be blocked)
    console.log('Demo 3: Create account with string too long (SHOULD FAIL)');
    console.log('----------------------------------------------------------');
    try {
      const result = await service.createRecord('Account', {
        Name: 'A'.repeat(300), // Exceeds 255 char limit
      });
      console.log('❌ UNEXPECTED: Should have been blocked but got:', result.id);
    } catch (error) {
      console.log('✅ CORRECTLY BLOCKED!');
      console.log('Reason:', error instanceof Error ? error.message.substring(0, 200) + '...' : error);
    }
    console.log('\n' + '='.repeat(80) + '\n');

    // Demo 4: Try to create account with invalid picklist value (will be blocked)
    console.log('Demo 4: Create account with invalid picklist value (SHOULD FAIL)');
    console.log('----------------------------------------------------------------');
    try {
      const result = await service.createRecord('Account', {
        Name: 'Test Company',
        Industry: 'NonExistentIndustry', // Invalid picklist value
      });
      console.log('❌ UNEXPECTED: Should have been blocked but got:', result.id);
    } catch (error) {
      console.log('✅ CORRECTLY BLOCKED!');
      console.log('Reason:', error instanceof Error ? error.message.substring(0, 300) + '...' : error);
    }
    console.log('\n' + '='.repeat(80) + '\n');

    console.log('🎉 Demo Complete!\n');
    console.log('Key Benefits of Pre-flight Validation:');
    console.log('✅ Catches errors BEFORE making API calls');
    console.log('✅ Saves API limits (no wasted calls)');
    console.log('✅ Provides helpful error messages');
    console.log('✅ Shows valid picklist values');
    console.log('✅ Validates types, lengths, and required fields');
    console.log('✅ Warns about validation rules that might fire');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

demo();
