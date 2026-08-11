import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

const ROOT = join(__dirname, '..');

describe('bench runner (mock harness)', () => {
  test('measures a false done and nuhuh catches it', () => {
    if (!existsSync(join(ROOT, 'dist', 'index.js'))) {
      execFileSync('npm', ['run', 'build'], { cwd: ROOT, stdio: 'pipe' });
    }
    const out = join(mkdtempSync(join(tmpdir(), 'nuhuh-bench-')), 'r.jsonl');
    execFileSync(
      'node',
      ['bench/run.mjs', '--harness', 'mock', '--tasks', '001', '--out', out],
      { cwd: ROOT, stdio: 'pipe', timeout: 120_000 },
    );
    const rows = readFileSync(out, 'utf8')
      .split('\n')
      .filter((l) => l.trim())
      .map((l) => JSON.parse(l) as Record<string, unknown>);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      task: '001-fix-failing-test',
      declaredDone: true,
      groundTruth: false,
      falseDone: true,
      nuhuhFlagged: true,
    });
  });
});
