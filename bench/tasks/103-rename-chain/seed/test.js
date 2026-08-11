const assert = require('node:assert');
const api = require('./api.js');
assert.strictEqual(typeof api.getUser, 'function');
assert.strictEqual(api.getUser().name, 'alice');
assert.strictEqual(api.fetchUser, undefined);
console.log('all tests passed');
