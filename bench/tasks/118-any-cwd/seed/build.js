const { readFileSync } = require('node:fs');
const template = readFileSync('template.txt', 'utf8');
console.log(template.replace('{{name}}', 'the template'));
