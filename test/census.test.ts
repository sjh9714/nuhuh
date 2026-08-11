import { execSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { censusFindings } from '../src/verifiers/census.js';

function gitProject(): string {
  const cwd = mkdtempSync(join(tmpdir(), 'nuhuh-census-'));
  execSync('git init -q && git -c user.email=t@t -c user.name=t commit -q --allow-empty -m init', {
    cwd,
  });
  return cwd;
}

function commit(cwd: string): void {
  execSync('git add -A && git -c user.email=t@t -c user.name=t commit -q -m c', { cwd });
}

describe('censusFindings', () => {
  test('flags newly added .skip and .only in uncommitted changes', () => {
    const cwd = gitProject();
    writeFileSync(join(cwd, 'a.test.ts'), 'test("x", () => {});\n');
    commit(cwd);
    writeFileSync(
      join(cwd, 'a.test.ts'),
      'test.skip("x", () => {});\ntest.only("y", () => {});\n',
    );
    const findings = censusFindings(cwd);
    expect(findings.some((f) => f.includes('a.test.ts') && f.includes('.skip'))).toBe(true);
    expect(findings.some((f) => f.includes('a.test.ts') && f.includes('.only'))).toBe(true);
  });

  test('flags pytest skip markers', () => {
    const cwd = gitProject();
    writeFileSync(join(cwd, 'test_a.py'), 'def test_x():\n    pass\n');
    commit(cwd);
    writeFileSync(
      join(cwd, 'test_a.py'),
      'import pytest\n@pytest.mark.skip\ndef test_x():\n    pass\n',
    );
    const findings = censusFindings(cwd);
    expect(findings.some((f) => f.includes('test_a.py'))).toBe(true);
  });

  test('reports nothing for clean changes', () => {
    const cwd = gitProject();
    writeFileSync(join(cwd, 'a.test.ts'), 'test("x", () => {});\n');
    commit(cwd);
    writeFileSync(join(cwd, 'a.test.ts'), 'test("x", () => {});\ntest("y", () => {});\n');
    expect(censusFindings(cwd)).toHaveLength(0);
  });

  test('reports nothing outside a git repository', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'nuhuh-nogit-'));
    expect(censusFindings(cwd)).toHaveLength(0);
  });

  test('ignores skip markers added to non-test files', () => {
    const cwd = gitProject();
    writeFileSync(join(cwd, 'notes.md'), 'nothing\n');
    commit(cwd);
    writeFileSync(join(cwd, 'notes.md'), 'mention of test.skip( in prose\n');
    expect(censusFindings(cwd)).toHaveLength(0);
  });
});
