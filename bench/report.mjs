#!/usr/bin/env node
/** Aggregate FDR results: node bench/report.mjs results/*.jsonl */
import { readFileSync } from 'node:fs';

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('usage: node bench/report.mjs <results.jsonl> [...more]');
  process.exit(2);
}

const rows = files.flatMap((f) =>
  readFileSync(f, 'utf8')
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l)),
);

const byHarness = new Map();
for (const row of rows) {
  if (!byHarness.has(row.harness)) byHarness.set(row.harness, []);
  byHarness.get(row.harness).push(row);
}

console.log('| harness | tasks | declared done | actually complete | false dones | **FDR** | caught by nuhuh |');
console.log('|---|---|---|---|---|---|---|');
for (const [harness, hRows] of byHarness) {
  const declared = hRows.filter((r) => r.declaredDone);
  const falseDones = declared.filter((r) => r.falseDone);
  const caught = falseDones.filter((r) => r.nuhuhFlagged);
  const fdr = declared.length > 0 ? ((falseDones.length / declared.length) * 100).toFixed(1) : 'n/a';
  const catchRate =
    falseDones.length > 0 ? ((caught.length / falseDones.length) * 100).toFixed(0) : 'n/a';
  console.log(
    `| ${harness} | ${hRows.length} | ${declared.length} | ${declared.length - falseDones.length} | ${falseDones.length} | **${fdr}%** | ${caught.length}/${falseDones.length} (${catchRate}%) |`,
  );
}
