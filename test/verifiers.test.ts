import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, test } from 'vitest';
import { verifyClaim } from '../src/verifiers/index.js';
import type { Claim } from '../src/types.js';

function tmpProject(): string {
  return mkdtempSync(join(tmpdir(), 'nuhuh-proj-'));
}

function claim(type: Claim['type'], subject?: string): Claim {
  return { type, quote: `quote for ${type}`, ...(subject ? { subject } : {}) };
}

describe('file-created verifier', () => {
  test('verifies when the claimed file exists', async () => {
    const cwd = tmpProject();
    mkdirSync(join(cwd, 'src'));
    writeFileSync(join(cwd, 'src', 'a.ts'), 'export const a = 1;\n');
    const verdict = await verifyClaim(claim('file-created', 'src/a.ts'), { cwd });
    expect(verdict.status).toBe('verified');
    expect(verdict.evidence).toContain('src/a.ts');
  });

  test('fails when the claimed file does not exist', async () => {
    const cwd = tmpProject();
    const verdict = await verifyClaim(claim('file-created', 'src/missing.ts'), { cwd });
    expect(verdict.status).toBe('failed');
  });

  test('is unverifiable when the path escapes the project', async () => {
    const cwd = tmpProject();
    const verdict = await verifyClaim(claim('file-created', '../../etc/passwd'), { cwd });
    expect(verdict.status).toBe('unverifiable');
  });
});

describe('tests-pass verifier', () => {
  test('verifies by running the npm test script fresh (exit 0)', async () => {
    const cwd = tmpProject();
    writeFileSync(
      join(cwd, 'package.json'),
      JSON.stringify({ name: 'x', scripts: { test: 'node -e "process.exit(0)"' } }),
    );
    const verdict = await verifyClaim(claim('tests-pass'), { cwd });
    expect(verdict.status).toBe('verified');
    expect(verdict.exitCode).toBe(0);
    expect(verdict.command).toContain('test');
  });

  test('writes evidence in plain words, with no dash or arrow connectors', async () => {
    const cwd = tmpProject();
    writeFileSync(
      join(cwd, 'package.json'),
      JSON.stringify({ name: 'x', scripts: { test: 'node -e "console.log(1); process.exit(1)"' } }),
    );
    const verdict = await verifyClaim(claim('tests-pass'), { cwd });
    expect(verdict.evidence).not.toMatch(/[—→]/);
    expect(verdict.evidence).toContain('exit 1');
  });

  test('fails when the fresh test run exits non-zero', async () => {
    const cwd = tmpProject();
    writeFileSync(
      join(cwd, 'package.json'),
      JSON.stringify({ name: 'x', scripts: { test: 'node -e "console.error(\'1 failed\'); process.exit(1)"' } }),
    );
    const verdict = await verifyClaim(claim('tests-pass'), { cwd });
    expect(verdict.status).toBe('failed');
    expect(verdict.exitCode).toBe(1);
  });

  test('is unverifiable when no test runner can be detected', async () => {
    const cwd = tmpProject();
    writeFileSync(join(cwd, 'package.json'), JSON.stringify({ name: 'x' }));
    const verdict = await verifyClaim(claim('tests-pass'), { cwd });
    expect(verdict.status).toBe('unverifiable');
  });

  test('annotates a green suite with census notes when the session skipped tests', async () => {
    const { execSync } = await import('node:child_process');
    const cwd = tmpProject();
    writeFileSync(
      join(cwd, 'package.json'),
      JSON.stringify({ name: 'x', scripts: { test: 'node -e "process.exit(0)"' } }),
    );
    writeFileSync(join(cwd, 'a.test.ts'), 'test("x", () => {});\n');
    execSync('git init -q && git add -A && git -c user.email=t@t -c user.name=t commit -q -m c', {
      cwd,
    });
    writeFileSync(join(cwd, 'a.test.ts'), 'test.skip("x", () => {});\n');
    const verdict = await verifyClaim(claim('tests-pass'), { cwd });
    expect(verdict.status).toBe('verified');
    expect(verdict.evidence).toContain('.skip');
  });

  test('treats the npm placeholder test script as unverifiable, not failed', async () => {
    const cwd = tmpProject();
    writeFileSync(
      join(cwd, 'package.json'),
      JSON.stringify({
        name: 'x',
        scripts: { test: 'echo "Error: no test specified" && exit 1' },
      }),
    );
    const verdict = await verifyClaim(claim('tests-pass'), { cwd });
    expect(verdict.status).toBe('unverifiable');
  });
});

describe('endpoint-works verifier', () => {
  const servers: Server[] = [];
  afterAll(() => {
    for (const s of servers) s.close();
  });

  function listen(handler: Parameters<typeof createServer>[1]): Promise<number> {
    return new Promise((resolvePort) => {
      const server = createServer(handler);
      servers.push(server);
      server.listen(0, '127.0.0.1', () => {
        const address = server.address();
        resolvePort(typeof address === 'object' && address ? address.port : 0);
      });
    });
  }

  test('verifies when the endpoint responds 2xx', async () => {
    const port = await listen((_req, res) => {
      res.writeHead(200);
      res.end('ok');
    });
    const verdict = await verifyClaim(claim('endpoint-works', `http://localhost:${port}/health`), {
      cwd: tmpProject(),
    });
    expect(verdict.status).toBe('verified');
    expect(verdict.evidence).toContain('200');
  });

  test('fails when the endpoint responds 5xx', async () => {
    const port = await listen((_req, res) => {
      res.writeHead(500);
      res.end('boom');
    });
    const verdict = await verifyClaim(claim('endpoint-works', `http://localhost:${port}/api`), {
      cwd: tmpProject(),
    });
    expect(verdict.status).toBe('failed');
    expect(verdict.evidence).toContain('500');
  });

  test('is unverifiable when nothing is listening (server may just be off)', async () => {
    const verdict = await verifyClaim(claim('endpoint-works', 'http://localhost:1/nope'), {
      cwd: tmpProject(),
    });
    expect(verdict.status).toBe('unverifiable');
  });

  test('never probes non-local hosts', async () => {
    const verdict = await verifyClaim(claim('endpoint-works', 'https://example.com/x'), {
      cwd: tmpProject(),
    });
    expect(verdict.status).toBe('unverifiable');
    expect(verdict.evidence.toLowerCase()).toContain('local');
  });
});

describe('env-set verifier', () => {
  test('verifies when the key exists in .env, without leaking the value', async () => {
    const cwd = tmpProject();
    writeFileSync(join(cwd, '.env'), 'DATABASE_URL=postgres://secret-hostname/db\n');
    const verdict = await verifyClaim(claim('env-set', 'DATABASE_URL'), { cwd });
    expect(verdict.status).toBe('verified');
    expect(verdict.evidence).toContain('.env');
    expect(verdict.evidence).not.toContain('secret-hostname');
  });

  test('regression: a key documented only in .env.example is verified, not accused', async () => {
    // Live false accusation: agent documented API_KEY in .env.example (as asked)
    // and nuhuh said "no .env file exists, so API_KEY is not set anywhere".
    const cwd = tmpProject();
    writeFileSync(join(cwd, '.env.example'), 'API_KEY=\n');
    const verdict = await verifyClaim(claim('env-set', 'API_KEY'), { cwd });
    expect(verdict.status).toBe('verified');
    expect(verdict.evidence).toContain('.env.example');
  });

  test('checks .env.local too', async () => {
    const cwd = tmpProject();
    writeFileSync(join(cwd, '.env.local'), 'STRIPE_KEY=sk_123\n');
    const verdict = await verifyClaim(claim('env-set', 'STRIPE_KEY'), { cwd });
    expect(verdict.status).toBe('verified');
  });

  test('fails when the key is missing from every env file', async () => {
    const cwd = tmpProject();
    writeFileSync(join(cwd, '.env'), 'OTHER=1\n');
    const verdict = await verifyClaim(claim('env-set', 'DATABASE_URL'), { cwd });
    expect(verdict.status).toBe('failed');
  });

  test('fails when no env file exists at all', async () => {
    const verdict = await verifyClaim(claim('env-set', 'DATABASE_URL'), { cwd: tmpProject() });
    expect(verdict.status).toBe('failed');
  });
});

describe('negative-existence verifier', () => {
  test('verifies when the path is really gone', async () => {
    const verdict = await verifyClaim(claim('negative-existence', 'legacy/config.yml'), {
      cwd: tmpProject(),
    });
    expect(verdict.status).toBe('verified');
  });

  test('fails when the path still exists', async () => {
    const cwd = tmpProject();
    mkdirSync(join(cwd, 'legacy'));
    writeFileSync(join(cwd, 'legacy', 'config.yml'), 'a: 1\n');
    const verdict = await verifyClaim(claim('negative-existence', 'legacy/config.yml'), { cwd });
    expect(verdict.status).toBe('failed');
    expect(verdict.evidence).toContain('still exists');
  });

  test('is unverifiable when the path escapes the project', async () => {
    const verdict = await verifyClaim(claim('negative-existence', '../../etc/passwd'), {
      cwd: tmpProject(),
    });
    expect(verdict.status).toBe('unverifiable');
  });
});

describe('build-pass verifier', () => {
  test('verifies by running the build script fresh (exit 0)', async () => {
    const cwd = tmpProject();
    writeFileSync(
      join(cwd, 'package.json'),
      JSON.stringify({ name: 'x', scripts: { build: 'node -e "process.exit(0)"' } }),
    );
    const verdict = await verifyClaim(claim('build-pass'), { cwd });
    expect(verdict.status).toBe('verified');
  });

  test('fails when the build exits non-zero', async () => {
    const cwd = tmpProject();
    writeFileSync(
      join(cwd, 'package.json'),
      JSON.stringify({ name: 'x', scripts: { build: 'node -e "process.exit(2)"' } }),
    );
    const verdict = await verifyClaim(claim('build-pass'), { cwd });
    expect(verdict.status).toBe('failed');
    expect(verdict.exitCode).toBe(2);
  });

  test('is unverifiable without a build script', async () => {
    const cwd = tmpProject();
    writeFileSync(join(cwd, 'package.json'), JSON.stringify({ name: 'x' }));
    const verdict = await verifyClaim(claim('build-pass'), { cwd });
    expect(verdict.status).toBe('unverifiable');
  });
});
