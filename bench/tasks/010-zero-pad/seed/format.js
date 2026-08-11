const total = Number(process.argv[2] ?? 0);
const m = Math.floor(total / 60);
const s = total % 60;
console.log(`${m}:${s}`);
