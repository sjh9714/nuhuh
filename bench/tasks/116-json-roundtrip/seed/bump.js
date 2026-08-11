const { writeFileSync } = require('node:fs');
const version = process.argv[2];
if (!version) process.exit(2);
writeFileSync('data.json', JSON.stringify({ version }, null, 2) + '\n');
console.log(`bumped to ${version}`);
