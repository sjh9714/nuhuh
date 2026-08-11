import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { decideGate } from '../src/gate/gate.js';
import { readDecisionLog, renderDecisionLog } from '../src/gate/decision-log.js';

function setup(finalMessage: string): {
  cwd: string;
  transcriptPath: string;
  stateDir: string;
  logDir: string;
} {
  const root = mkdtempSync(join(tmpdir(), 'nuhuh-log-'));
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
  return { cwd, transcriptPath, stateDir: join(root, 'state'), logDir: join(root, 'nuhuh-home') };
}

const base = {
  sessionId: 's1',
  stopHookActive: false,
  maxBounces: 3,
  env: {} as Record<string, string | undefined>,
};

describe('gate decision log', () => {
  test('a block appends an entry with the verdicts and the action', async () => {
    const { cwd, transcriptPath, stateDir, logDir } = setup('Done. I created `src/ghost.ts`.');
    await decideGate({ ...base, cwd, transcriptPath, stateDir, logDir });
    const entries = readDecisionLog(logDir);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ action: 'block', sessionId: 's1' });
    expect(entries[0]?.verdicts).toMatchObject([
      { type: 'file-created', status: 'failed' },
    ]);
    expect(typeof entries[0]?.at).toBe('string');
  });

  test('an allow with verified claims is logged too', async () => {
    const { cwd, transcriptPath, stateDir, logDir } = setup('Done. I created `src/real.ts`.');
    mkdirSync(join(cwd, 'src'));
    writeFileSync(join(cwd, 'src', 'real.ts'), 'export {};\n');
    await decideGate({ ...base, cwd, transcriptPath, stateDir, logDir });
    const entries = readDecisionLog(logDir);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ action: 'allow' });
  });

  test('a message with no checkable claims is not logged', async () => {
    const { cwd, transcriptPath, stateDir, logDir } = setup('Let me know what you think.');
    await decideGate({ ...base, cwd, transcriptPath, stateDir, logDir });
    expect(readDecisionLog(logDir)).toHaveLength(0);
  });

  test('renderDecisionLog prints one line per entry, newest last', async () => {
    const { cwd, transcriptPath, stateDir, logDir } = setup('Done. I created `src/ghost.ts`.');
    await decideGate({ ...base, cwd, transcriptPath, stateDir, logDir });
    await decideGate({ ...base, cwd, transcriptPath, stateDir, logDir });
    const out = renderDecisionLog(readDecisionLog(logDir));
    expect(out).toContain('block');
    expect(out).toContain('src/ghost.ts');
    expect(out.trim().split('\n').length).toBeGreaterThanOrEqual(2);
  });

  test('an empty log renders a friendly line', () => {
    expect(renderDecisionLog([]).toLowerCase()).toContain('no gate decisions');
  });
});
