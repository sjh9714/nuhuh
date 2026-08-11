import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { decideGate } from '../src/gate/gate.js';

function setup(finalMessage: string): {
  cwd: string;
  transcriptPath: string;
  stateDir: string;
} {
  const root = mkdtempSync(join(tmpdir(), 'nuhuh-gate-'));
  const cwd = join(root, 'proj');
  mkdirSync(cwd);
  const transcriptPath = join(root, 's1.jsonl');
  writeFileSync(
    transcriptPath,
    JSON.stringify({
      type: 'assistant',
      sessionId: 's1',
      message: { role: 'assistant', content: [{ type: 'text', text: finalMessage }] },
    }) + '\n',
  );
  return { cwd, transcriptPath, stateDir: join(root, 'state') };
}

const base = { sessionId: 's1', stopHookActive: false, maxBounces: 3, env: {} as Record<string, string | undefined> };

describe('decideGate', () => {
  test('blocks with evidence when a claim fails the experiment', async () => {
    const { cwd, transcriptPath, stateDir } = setup('Done. I created `src/ghost.ts`.');
    const decision = await decideGate({ ...base, cwd, transcriptPath, stateDir });
    expect(decision.action).toBe('block');
    expect(decision.reason).toContain('src/ghost.ts');
    expect(decision.reason).toContain('does not exist');
  });

  test('allows when every claim verifies', async () => {
    const { cwd, transcriptPath, stateDir } = setup('Done. I created `src/real.ts`.');
    mkdirSync(join(cwd, 'src'));
    writeFileSync(join(cwd, 'src', 'real.ts'), 'export {};\n');
    const decision = await decideGate({ ...base, cwd, transcriptPath, stateDir });
    expect(decision.action).toBe('allow');
  });

  test('allows when there are no checkable claims', async () => {
    const { cwd, transcriptPath, stateDir } = setup('Let me know what you think.');
    const decision = await decideGate({ ...base, cwd, transcriptPath, stateDir });
    expect(decision.action).toBe('allow');
  });

  test('is disabled by NUHUH_OFF', async () => {
    const { cwd, transcriptPath, stateDir } = setup('Done. I created `src/ghost.ts`.');
    const decision = await decideGate({
      ...base,
      cwd,
      transcriptPath,
      stateDir,
      env: { NUHUH_OFF: '1' },
    });
    expect(decision.action).toBe('allow');
  });

  test('gives up and allows after maxBounces blocks for the same session', async () => {
    const { cwd, transcriptPath, stateDir } = setup('Done. I created `src/ghost.ts`.');
    const input = { ...base, cwd, transcriptPath, stateDir, stopHookActive: true };
    expect((await decideGate(input)).action).toBe('block');
    expect((await decideGate(input)).action).toBe('block');
    expect((await decideGate(input)).action).toBe('block');
    const fourth = await decideGate(input);
    expect(fourth.action).toBe('allow');
    expect(fourth.warning).toContain('3');
  });

  test('tracks bounce counts per session', async () => {
    const { cwd, transcriptPath, stateDir } = setup('Done. I created `src/ghost.ts`.');
    const a = { ...base, cwd, transcriptPath, stateDir, sessionId: 'a' };
    const b = { ...base, cwd, transcriptPath, stateDir, sessionId: 'b' };
    await decideGate(a);
    await decideGate(a);
    await decideGate(a);
    expect((await decideGate(a)).action).toBe('allow');
    expect((await decideGate(b)).action).toBe('block');
  });
});
