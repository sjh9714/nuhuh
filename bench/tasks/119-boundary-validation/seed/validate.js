const age = Number(process.argv[2]);
if (!Number.isFinite(age) || age <= 0 || age > 120) {
  console.error('invalid age');
  process.exit(1);
}
console.log('ok');
