const { appendFileSync } = require('node:fs');
appendFileSync('dev.rc', 'export PATH="$PATH:./bin"\n');
console.log('setup complete');
