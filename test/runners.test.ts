import { execSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { detectCommand } from '../src/verifiers/runners.js';
import { verifyClaim } from '../src/verifiers/index.js';
import type { Claim } from '../src/types.js';

function tmpProject(): string {
  return mkdtempSync(join(tmpdir(), 'nuhuh-runner-'));
}

function claim(type: Claim['type']): Claim {
  return { type, quote: `quote for ${type}` };
}

function has(command: string): boolean {
  try {
    execSync(command, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

const hasGo = has('go version');
const hasCargo = has('cargo --version');
const hasPytest = has('pytest --version');

describe('detectCommand', () => {
  test('finds nothing in an empty project', () => {
    expect(detectCommand(tmpProject(), 'test')).toBeNull();
  });

  test('prefers the package.json script when one exists', () => {
    const cwd = tmpProject();
    writeFileSync(join(cwd, 'package.json'), JSON.stringify({ scripts: { test: 'vitest run' } }));
    writeFileSync(join(cwd, 'go.mod'), 'module x\n');
    expect(detectCommand(cwd, 'test')?.command).toBe('npm test');
  });

  test('falls through the npm placeholder test script to another toolchain', () => {
    const cwd = tmpProject();
    writeFileSync(
      join(cwd, 'package.json'),
      JSON.stringify({ scripts: { test: 'echo "Error: no test specified" && exit 1' } }),
    );
    writeFileSync(join(cwd, 'go.mod'), 'module x\n');
    expect(detectCommand(cwd, 'test')?.command).toBe('go test ./...');
  });

  test('detects a go module', () => {
    const cwd = tmpProject();
    writeFileSync(join(cwd, 'go.mod'), 'module x\n');
    expect(detectCommand(cwd, 'test')?.command).toBe('go test ./...');
    expect(detectCommand(cwd, 'build')?.command).toBe('go build ./...');
    expect(detectCommand(cwd, 'lint')?.command).toBe('go vet ./...');
  });

  test('detects a cargo crate, without inventing a lint command', () => {
    const cwd = tmpProject();
    writeFileSync(join(cwd, 'Cargo.toml'), '[package]\nname = "x"\n');
    expect(detectCommand(cwd, 'test')?.command).toBe('cargo test');
    expect(detectCommand(cwd, 'build')?.command).toBe('cargo build');
    // clippy is not part of every toolchain install, so no lint command is safer
    expect(detectCommand(cwd, 'lint')).toBeNull();
  });

  test('detects pytest from pytest.ini', () => {
    const cwd = tmpProject();
    writeFileSync(join(cwd, 'pytest.ini'), '[pytest]\n');
    expect(detectCommand(cwd, 'test')?.command).toBe('pytest');
  });

  test('detects pytest from conftest.py', () => {
    const cwd = tmpProject();
    writeFileSync(join(cwd, 'conftest.py'), '');
    expect(detectCommand(cwd, 'test')?.command).toBe('pytest');
  });

  test('detects pytest from a pyproject.toml that configures it', () => {
    const cwd = tmpProject();
    writeFileSync(join(cwd, 'pyproject.toml'), '[tool.pytest.ini_options]\ntestpaths = ["tests"]\n');
    expect(detectCommand(cwd, 'test')?.command).toBe('pytest');
  });

  test('does not read a bare pyproject.toml as a pytest project', () => {
    const cwd = tmpProject();
    writeFileSync(join(cwd, 'pyproject.toml'), '[project]\nname = "x"\n');
    expect(detectCommand(cwd, 'test')).toBeNull();
  });

  test('a pytest project has no build or lint command', () => {
    const cwd = tmpProject();
    writeFileSync(join(cwd, 'pytest.ini'), '[pytest]\n');
    expect(detectCommand(cwd, 'build')).toBeNull();
    expect(detectCommand(cwd, 'lint')).toBeNull();
  });

  test('detects the gradle wrapper, never a global gradle', () => {
    const cwd = tmpProject();
    writeFileSync(join(cwd, 'gradlew'), '#!/bin/sh\n');
    writeFileSync(join(cwd, 'gradlew.bat'), '@echo off\n');
    const expected = process.platform === 'win32' ? 'gradlew.bat test' : './gradlew test';
    expect(detectCommand(cwd, 'test')?.command).toBe(expected);
  });

  test('a build.gradle without the wrapper detects nothing, because a global gradle is not manifest-blessed', () => {
    const cwd = tmpProject();
    writeFileSync(join(cwd, 'build.gradle'), '');
    expect(detectCommand(cwd, 'test')).toBeNull();
  });
});

describe('tests-pass verifier on non-npm projects', () => {
  test.skipIf(!hasGo)(
    'fails a go project whose fresh go test run fails',
    async () => {
      const cwd = tmpProject();
      writeFileSync(join(cwd, 'go.mod'), 'module nuhuhtest\n\ngo 1.21\n');
      writeFileSync(
        join(cwd, 'x_test.go'),
        'package nuhuhtest\n\nimport "testing"\n\nfunc TestFails(t *testing.T) { t.Fatal("nope") }\n',
      );
      const verdict = await verifyClaim(claim('tests-pass'), { cwd, timeoutMs: 120_000 });
      expect(verdict.status).toBe('failed');
      expect(verdict.evidence).toContain('go test');
    },
    180_000,
  );

  test.skipIf(!hasGo)(
    'verifies a go project whose fresh go test run passes',
    async () => {
      const cwd = tmpProject();
      writeFileSync(join(cwd, 'go.mod'), 'module nuhuhtest\n\ngo 1.21\n');
      writeFileSync(
        join(cwd, 'x_test.go'),
        'package nuhuhtest\n\nimport "testing"\n\nfunc TestOk(t *testing.T) {}\n',
      );
      const verdict = await verifyClaim(claim('tests-pass'), { cwd, timeoutMs: 120_000 });
      expect(verdict.status).toBe('verified');
    },
    180_000,
  );

  test.skipIf(!hasPytest)(
    'fails a pytest project whose fresh pytest run fails',
    async () => {
      const cwd = tmpProject();
      writeFileSync(join(cwd, 'pytest.ini'), '[pytest]\n');
      writeFileSync(join(cwd, 'test_x.py'), 'def test_fails():\n    assert False\n');
      const verdict = await verifyClaim(claim('tests-pass'), { cwd, timeoutMs: 120_000 });
      expect(verdict.status).toBe('failed');
      expect(verdict.evidence).toContain('pytest');
    },
    180_000,
  );

  test.skipIf(!hasCargo)(
    'fails a cargo crate whose fresh cargo test run fails',
    async () => {
      const cwd = tmpProject();
      writeFileSync(
        join(cwd, 'Cargo.toml'),
        '[package]\nname = "nuhuhtest"\nversion = "0.0.1"\nedition = "2021"\n',
      );
      mkdirSync(join(cwd, 'src'));
      writeFileSync(
        join(cwd, 'src', 'lib.rs'),
        '#[cfg(test)]\nmod tests {\n    #[test]\n    fn fails() {\n        panic!("nope")\n    }\n}\n',
      );
      const verdict = await verifyClaim(claim('tests-pass'), { cwd, timeoutMs: 120_000 });
      expect(verdict.status).toBe('failed');
    },
    180_000,
  );
});
