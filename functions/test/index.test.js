const test = require('node:test');
const assert = require('node:assert');
const { formatJulesError } = require('../index.js');

test('formatJulesError should return the correct static string for various inputs', () => {
  const expectedString = 'Failed to create Jules session. Most likely causes: (1) API rate limit - wait a few minutes, (2) Invalid API key - check your settings, (3) Repository access - verify permissions.';

  // Test with null error and typical status code
  assert.strictEqual(formatJulesError(null, 401), expectedString);

  // Test with defined error object and different status code
  assert.strictEqual(formatJulesError({ message: 'Unauthorized' }, 403), expectedString);

  // Test with string error and undefined status code
  assert.strictEqual(formatJulesError('Rate Limit Exceeded', undefined), expectedString);
});
