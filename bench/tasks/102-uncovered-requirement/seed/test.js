const assert = require('node:assert');
const { slugify } = require('./slugify.js');
assert.strictEqual(slugify('Hello World'), 'hello-world');
assert.strictEqual(slugify('  Foo  Bar  '), 'foo-bar');
console.log('all tests passed');
