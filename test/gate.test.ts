import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { decideGate, renderGateOutput } from '../src/gate/gate.js';

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

  test('keeps the block reason to two lines so repeated bounces stay cheap', async () => {
    // Hook practitioners' top complaint: a chatty deny reason on a hook that
    // fires repeatedly becomes a recurring context tax.
    const { cwd, transcriptPath, stateDir } = setup(
      'Done. I created `src/a.ts` and wrote `src/b.ts` and added `src/c.ts`.',
    );
    const decision = await decideGate({ ...base, cwd, transcriptPath, stateDir });
    expect(decision.action).toBe('block');
    expect(decision.reason?.split('\n').length).toBeLessThanOrEqual(2);
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

  test('bails early when the same claim fails the same way twice in a row', async () => {
    // Suggested by a launch-thread commenter. Two identical failures mean the
    // diagnosis is wrong, so the third bounce would only make a bigger mess.
    const { cwd, transcriptPath, stateDir } = setup('Done. I created `src/ghost.ts`.');
    const input = { ...base, cwd, transcriptPath, stateDir };
    expect((await decideGate(input)).action).toBe('block');
    const second = await decideGate(input);
    expect(second.action).toBe('allow');
    expect(second.warning).toContain('same');
  });

  test('keeps blocking while the failures differ', async () => {
    const { cwd, transcriptPath, stateDir } = setup('Done. I created `src/ghost.ts`.');
    const input = { ...base, cwd, transcriptPath, stateDir };
    expect((await decideGate(input)).action).toBe('block');
    // the agent "progressed": now a different claim fails
    writeFileSync(
      transcriptPath,
      JSON.stringify({
        type: 'assistant',
        sessionId: 's1',
        message: {
          role: 'assistant',
          content: [{ type: 'text', text: 'Done. I created `src/other-ghost.ts`.' }],
        },
      }) + '\n',
    );
    expect((await decideGate(input)).action).toBe('block');
  });

  test('gives up after maxBounces even when every failure is different', async () => {
    const { cwd, transcriptPath, stateDir } = setup('Done. I created `src/ghost1.ts`.');
    const input = { ...base, cwd, transcriptPath, stateDir, stopHookActive: true };
    const rewrite = (path: string) =>
      writeFileSync(
        transcriptPath,
        JSON.stringify({
          type: 'assistant',
          sessionId: 's1',
          message: {
            role: 'assistant',
            content: [{ type: 'text', text: `Done. I created \`${path}\`.` }],
          },
        }) + '\n',
      );
    expect((await decideGate(input)).action).toBe('block');
    rewrite('src/ghost2.ts');
    expect((await decideGate(input)).action).toBe('block');
    rewrite('src/ghost3.ts');
    expect((await decideGate(input)).action).toBe('block');
    rewrite('src/ghost4.ts');
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

describe('receipt on allow', () => {
  test('an allow with verified claims carries the receipt', async () => {
    const { cwd, transcriptPath, stateDir } = setup('Done. I created `src/real.ts`.');
    mkdirSync(join(cwd, 'src'));
    writeFileSync(join(cwd, 'src', 'real.ts'), 'export {};\n');
    const decision = await decideGate({ ...base, cwd, transcriptPath, stateDir });
    expect(decision.action).toBe('allow');
    expect(decision.receipt).toContain('src/real.ts');
  });

  test('an allow with no checkable claims carries no receipt', async () => {
    const { cwd, transcriptPath, stateDir } = setup('Let me know what you think.');
    const decision = await decideGate({ ...base, cwd, transcriptPath, stateDir });
    expect(decision.action).toBe('allow');
    expect(decision.receipt).toBeUndefined();
  });
});

describe('renderGateOutput', () => {
  test('blocks render a block decision', () => {
    const out = renderGateOutput({ action: 'block', reason: 'r' }, {});
    expect(JSON.parse(out ?? '')).toEqual({ decision: 'block', reason: 'r' });
  });

  test('a clean allow stays silent by default', () => {
    expect(renderGateOutput({ action: 'allow', receipt: '🧾' }, {})).toBeNull();
  });

  test('NUHUH_RECEIPT=always surfaces the success receipt', () => {
    const out = renderGateOutput({ action: 'allow', receipt: '🧾 receipt' }, { NUHUH_RECEIPT: 'always' });
    expect(JSON.parse(out ?? '')).toEqual({ systemMessage: '🧾 receipt' });
  });

  test('NUHUH_RECEIPT=always with no receipt stays silent', () => {
    expect(renderGateOutput({ action: 'allow' }, { NUHUH_RECEIPT: 'always' })).toBeNull();
  });

  test('a warning still renders, and always mode appends the receipt', () => {
    const plain = renderGateOutput({ action: 'allow', warning: 'w', receipt: '🧾' }, {});
    expect(JSON.parse(plain ?? '')).toEqual({ systemMessage: 'w' });
    const both = renderGateOutput({ action: 'allow', warning: 'w', receipt: '🧾' }, { NUHUH_RECEIPT: 'always' });
    expect(JSON.parse(both ?? '')).toEqual({ systemMessage: 'w\n\n🧾' });
  });
});

describe('strict claimless-done mode', () => {
  const strictEnv = { NUHUH_STRICT: '1' } as Record<string, string | undefined>;

  test('bounces a done declaration that carries no checkable claim', async () => {
    const { cwd, transcriptPath, stateDir } = setup(
      "Done! I've removed all hardcoded ports from the codebase.",
    );
    const decision = await decideGate({ ...base, cwd, transcriptPath, stateDir, env: strictEnv });
    expect(decision.action).toBe('block');
    expect(decision.reason).toContain('checkable');
  });

  test('stays quiet without the strict flag, miss rather than accuse', async () => {
    const { cwd, transcriptPath, stateDir } = setup(
      "Done! I've removed all hardcoded ports from the codebase.",
    );
    const decision = await decideGate({ ...base, cwd, transcriptPath, stateDir });
    expect(decision.action).toBe('allow');
  });

  test('does not bounce a message that never declares completion', async () => {
    const { cwd, transcriptPath, stateDir } = setup('Which port should the server use?');
    const decision = await decideGate({ ...base, cwd, transcriptPath, stateDir, env: strictEnv });
    expect(decision.action).toBe('allow');
  });

  test('a verified claim satisfies strict mode', async () => {
    const { cwd, transcriptPath, stateDir } = setup('Done. I created `src/real.ts`.');
    mkdirSync(join(cwd, 'src'));
    writeFileSync(join(cwd, 'src', 'real.ts'), 'export {};\n');
    const decision = await decideGate({ ...base, cwd, transcriptPath, stateDir, env: strictEnv });
    expect(decision.action).toBe('allow');
  });

  test('gives up after the bounce budget like any other failure', async () => {
    const { cwd, transcriptPath, stateDir } = setup('Done! Everything is finished.');
    const input = { ...base, cwd, transcriptPath, stateDir, env: strictEnv };
    expect((await decideGate(input)).action).toBe('block');
    // same claimless message again -> same-failure early bail hands it to the human
    const second = await decideGate(input);
    expect(second.action).toBe('allow');
    expect(second.warning).toBeTruthy();
  });
});
