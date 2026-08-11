const tasks = require('./tasks.json');
const sorted = [...tasks].sort((a, b) => (a.priority < b.priority ? 1 : -1));
for (const t of sorted) console.log(t.name);
