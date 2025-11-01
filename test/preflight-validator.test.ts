/**
 * Test Pre-flight Validation
 * 
 * Tests the intelligent pre-flight validator that checks data before API calls
 */

import { SalesforceAuth } from '../src/auth.js';
import { getDatabase, MetadataDatabase } from '../src/database.js';
import { PreflightValidator } from '../src/preflight-validator.js';

async function testPreflightValidation() {
  console.log('🧪 Testing Pre-flight Validation...\n');

  try {
    // Initialize auth and database
    const auth = new SalesforceAuth();
    const conn = await auth.getConnection();
    const db = getDatabase();
    const validator = new PreflightValidator(db);

    console.log('✅ Initialized validator\n');

    // Test 1: Valid Account creation (should pass)
    console.log('Test 1: Valid Account creation');
    const validData = {
      Name: 'Test Company',
      Industry: 'Technology',
      Website: 'https://example.com',
    };
    
    const result1 = await validator.validateCreate('Account', validData);
    console.log(validator.getSummary(result1));
    console.log('\n' + '='.repeat(80) + '\n');

    // Test 2: Missing required field (should fail)
    console.log('Test 2: Missing required field');
    const invalidData = {
      Industry: 'Technology',
      Website: 'https://example.com',
      // Missing Name (required)
    };
    
    const result2 = await validator.validateCreate('Account', invalidData);
    console.log(validator.getSummary(result2));
    console.log('\n' + '='.repeat(80) + '\n');

    // Test 3: Type mismatch (should fail)
    console.log('Test 3: Type mismatch');
    const typeMismatchData = {
      Name: 'Test Company',
      NumberOfEmployees: 'not a number', // Should be number
    };
    
    const result3 = await validator.validateCreate('Account', typeMismatchData);
    console.log(validator.getSummary(result3));
    console.log('\n' + '='.repeat(80) + '\n');

    // Test 4: String length exceeded (should fail)
    console.log('Test 4: String length exceeded');
    const longStringData = {
      Name: 'A'.repeat(300), // Name field max is 255
    };
    
    const result4 = await validator.validateCreate('Account', longStringData);
    console.log(validator.getSummary(result4));
    console.log('\n' + '='.repeat(80) + '\n');

    // Test 5: Invalid picklist value (should fail)
    console.log('Test 5: Invalid picklist value');
    const invalidPicklistData = {
      Name: 'Test Company',
      Industry: 'Invalid Industry Value', // Not a valid picklist option
    };
    
    const result5 = await validator.validateCreate('Account', invalidPicklistData);
    console.log(validator.getSummary(result5));
    console.log('\n' + '='.repeat(80) + '\n');

    // Test 6: Update validation (should pass - no required fields check)
    console.log('Test 6: Update validation');
    const updateData = {
      Industry: 'Finance',
    };
    
    const result6 = await validator.validateUpdate('Account', '0011234567890ABC', updateData);
    console.log(validator.getSummary(result6));
    console.log('\n' + '='.repeat(80) + '\n');

    // Test 7: Unknown field warning
    console.log('Test 7: Unknown field warning');
    const unknownFieldData = {
      Name: 'Test Company',
      UnknownField__c: 'Some value', // Doesn't exist in metadata
    };
    
    const result7 = await validator.validateCreate('Account', unknownFieldData);
    console.log(validator.getSummary(result7));
    console.log('\n' + '='.repeat(80) + '\n');

    // Test 8: Contact with required relationship
    console.log('Test 8: Contact with required relationship');
    const contactData = {
      FirstName: 'John',
      // Missing LastName (required)
      // Missing AccountId (may be required depending on org settings)
    };
    
    const result8 = await validator.validateCreate('Contact', contactData);
    console.log(validator.getSummary(result8));
    console.log('\n' + '='.repeat(80) + '\n');

    // Summary
    console.log('📊 Test Summary:');
    console.log(`Total tests: 8`);
    console.log(`Expected failures: 5 (Tests 2, 3, 4, 5, 8)`);
    console.log(`Expected passes: 3 (Tests 1, 6, 7)`);
    
    const failures = [result2, result3, result4, result5, result8].filter(r => !r.valid).length;
    const passes = [result1, result6, result7].filter(r => r.valid).length;
    
    console.log(`\nActual failures: ${failures}/5`);
    console.log(`Actual passes: ${passes}/3`);
    
    if (failures === 5 && passes === 3) {
      console.log('\n✅ All tests passed as expected!');
    } else {
      console.log('\n⚠️  Some tests did not behave as expected');
    }

  } catch (error) {
    console.error('❌ Error during pre-flight validation test:', error);
    process.exit(1);
  }
}

testPreflightValidation();
