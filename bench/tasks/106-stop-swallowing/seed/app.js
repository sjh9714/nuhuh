const fs = require('node:fs');
let data = {};
try {
  data = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
} catch (e) {
  // ignore
}
console.log('done', Object.keys(data).length);
