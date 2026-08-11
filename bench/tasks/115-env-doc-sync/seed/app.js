const port = 3000;
if (process.argv.includes('--print-port')) {
  console.log(String(port));
  process.exit(0);
}
console.log(`would listen on ${port}`);
