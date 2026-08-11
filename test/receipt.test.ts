import { describe, expect, test } from 'vitest';
import { renderReceipt } from '../src/receipt/render.js';
import type { Verdict } from '../src/types.js';

const verified: Verdict = {
  claim: { type: 'file-created', quote: 'Created `src/a.ts`.', subject: 'src/a.ts' },
  status: 'verified',
  evidence: 'src/a.ts exists (20 bytes)',
};
const failed: Verdict = {
  claim: { type: 'tests-pass', quote: 'All tests pass.' },
  status: 'failed',
  evidence: 'ran `npm test` fresh → exit 1 — 2 failed',
  command: 'npm test',
  exitCode: 1,
};
const unverifiable: Verdict = {
  claim: { type: 'build-pass', quote: 'The build succeeds.' },
  status: 'unverifiable',
  evidence: 'no runnable build script found in package.json',
};

describe('renderReceipt', () => {
  test('renders one marked line per verdict with quote and evidence', () => {
    const out = renderReceipt([verified, failed], { color: false });
    expect(out).toContain('✅');
    expect(out).toContain('src/a.ts exists (20 bytes)');
    expect(out).toContain('❌');
    expect(out).toContain('All tests pass.');
    expect(out).toContain('exit 1');
  });

  test('leads with the subject when the claim names one, instead of repeating the sentence', () => {
    const out = renderReceipt([verified], { color: false });
    expect(out).toContain('✅ src/a.ts');
    expect(out).not.toContain('✅ Created');
  });

  test('marks unverifiable claims distinctly, never as failures', () => {
    const out = renderReceipt([unverifiable], { color: false });
    expect(out).toContain('⚠️');
    expect(out).not.toContain('❌');
  });

  test('summarizes verified vs claimed counts', () => {
    const out = renderReceipt([verified, failed, unverifiable], { color: false });
    expect(out).toContain('1 of 3 claims verified');
    expect(out).toContain('1 failed');
  });

  test('says so when there are no claims', () => {
    const out = renderReceipt([], { color: false });
    expect(out.toLowerCase()).toContain('no checkable claims');
  });

  test('omits ANSI codes when color is off and includes them when on', () => {
    expect(renderReceipt([failed], { color: false })).not.toContain('\x1b[');
    expect(renderReceipt([failed], { color: true })).toContain('\x1b[');
  });
});
