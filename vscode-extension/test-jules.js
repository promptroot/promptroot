// Quick test to verify Jules integration works
const { JulesClient } = require('./out/jules-client.js');

const mockOutputChannel = {
  appendLine: (message) => console.log('[Jules Test]', message)
};

const client = new JulesClient(mockOutputChannel);

// Test if client is properly instantiated
console.log('Jules Client created successfully');

// Test API key validation (will fail without real key, but should not crash)
client.testApiKey('fake-key').then(result => {
  console.log('API key test result:', result);
}).catch(error => {
  console.log('Expected error for fake key:', error.message);
});