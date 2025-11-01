import { SalesforceAuth } from '../src/auth.js';

async function testAuth() {
  console.log('Testing Salesforce authentication...\n');

  try {
    const auth = new SalesforceAuth();
    const result = await auth.testConnection();

    if (!result.success) {
      console.error('❌ Authentication failed:', result.error);
      process.exit(1);
    }

    console.log('✅ Authentication successful!\n');
    console.log('User Info:');
    console.log(`  User ID: ${result.userInfo!.userId}`);
    console.log(`  Username: ${result.userInfo!.username}`);
    console.log(`  Organization ID: ${result.userInfo!.organizationId}`);
    console.log(`  Display Name: ${result.userInfo!.displayName}`);
    console.log('\n✅ MCP server is ready!');
  } catch (error) {
    console.error('❌ Authentication failed:', error);
    process.exit(1);
  }
}

testAuth();
