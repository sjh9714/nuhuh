const assert = require('node:assert');
assert.strictEqual(require('./list.js').limit(), 10);
assert.ok(require('./report.js').header().includes('10'));
console.log('all tests passed');
