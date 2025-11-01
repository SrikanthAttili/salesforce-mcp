import { getDatabase } from '../src/database.js';

const db = getDatabase();

// Check required fields for Account
const requiredFields = db.getRequiredFields('Account');
console.log('Required fields for Account:');
requiredFields.forEach(f => {
  console.log(`  - ${f.name} (${f.type})`);
});

// Check Name field specifically
const allFields = db.getFields('Account');
const nameField = allFields.find(f => f.name === 'Name');
console.log('\nName field details:');
console.log(JSON.stringify(nameField, null, 2));
