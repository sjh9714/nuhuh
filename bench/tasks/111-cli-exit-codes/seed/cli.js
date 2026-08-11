const name = process.argv[2];
if (!name) {
  console.log('usage: node cli.js <name>');
} else {
  console.log(`hello ${name}`);
}
