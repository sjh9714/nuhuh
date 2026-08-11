import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { postHoc } from '../src/app.js';
import { encodeCwd } from '../src/transcript/claude-code.js';

function setup(finalMessage: string): { cwd: string; projectsDir: string } {
  const root = mkdtempSync(join(tmpdir(), 'nuhuh-app-'));
  const cwd = join(root, 'proj');
  mkdirSync(cwd);
  const projectsDir = join(root, 'claude-projects');
  const sessionDir = join(projectsDir, encodeCwd(cwd));
  mkdirSync(sessionDir, { recursive: true });
  const line = {
    type: 'assistant',
    timestamp: '2026-08-11T04:00:00.000Z',
    sessionId: 's1',
    message: { role: 'assistant', content: [{ type: 'text', text: finalMessage }] },
  };
  writeFileSync(join(sessionDir, 's1.jsonl'), JSON.stringify(line) + '\n');
  return { cwd, projectsDir };
}

describe('postHoc', () => {
  test('verifies true claims and exits 0', async () => {
    const { cwd, projectsDir } = setup('Done! I created `src/a.ts`.');
    mkdirSync(join(cwd, 'src'));
    writeFileSync(join(cwd, 'src', 'a.ts'), 'export {};\n');
    const result = await postHoc({ cwd, projectsDir, color: false });
    expect(result.exitCode).toBe(0);
    expect(result.receipt).toContain('✅');
  });

  test('catches a false claim and exits 1', async () => {
    const { cwd, projectsDir } = setup('Done! I created `src/ghost.ts`. All tests pass.');
    writeFileSync(
      join(cwd, 'package.json'),
      JSON.stringify({ name: 'p', scripts: { test: 'node -e "process.exit(1)"' } }),
    );
    const result = await postHoc({ cwd, projectsDir, color: false });
    expect(result.exitCode).toBe(1);
    expect(result.receipt).toContain('❌');
  });

  test('reports gracefully when there is no session for the project', async () => {
    const root = mkdtempSync(join(tmpdir(), 'nuhuh-app-'));
    const result = await postHoc({
      cwd: root,
      projectsDir: join(root, 'none'),
      codexHome: join(root, 'no-codex'),
      color: false,
    });
    expect(result.exitCode).toBe(0);
    expect(result.receipt.toLowerCase()).toContain('no claude code or codex session');
  });

  test('falls back to the latest Codex session when Claude Code has none', async () => {
    const root = mkdtempSync(join(tmpdir(), 'nuhuh-app-'));
    const cwd = join(root, 'proj');
    mkdirSync(cwd);
    const codexHome = join(root, 'codex');
    const day = join(codexHome, 'sessions', '2026', '08', '11');
    mkdirSync(day, { recursive: true });
    writeFileSync(
      join(day, 'rollout-x.jsonl'),
      [
        JSON.stringify({ type: 'session_meta', payload: { cwd } }),
        JSON.stringify({
          type: 'response_item',
          payload: {
            type: 'message',
            role: 'assistant',
            content: [{ type: 'output_text', text: 'Done! I created `src/ghost.ts`.' }],
          },
        }),
      ].join('\n') + '\n',
    );
    const result = await postHoc({
      cwd,
      projectsDir: join(root, 'no-claude'),
      codexHome,
      color: false,
    });
    expect(result.exitCode).toBe(1);
    expect(result.receipt).toContain('src/ghost.ts');
  });
});
