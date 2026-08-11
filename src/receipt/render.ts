import type { Verdict, VerdictStatus } from '../types.js';

export interface RenderOptions {
  color: boolean;
}

const MARK: Record<VerdictStatus, string> = {
  verified: '✅',
  failed: '❌',
  unverifiable: '⚠️',
};

const ANSI: Record<VerdictStatus, string> = {
  verified: '\x1b[32m',
  failed: '\x1b[31m',
  unverifiable: '\x1b[33m',
};
const RESET = '\x1b[0m';
const DIM = '\x1b[2m';

export function renderReceipt(verdicts: Verdict[], opts: RenderOptions): string {
  const lines: string[] = [];
  lines.push('🧾 receipt');
  lines.push('');

  if (verdicts.length === 0) {
    lines.push('no checkable claims in the last message.');
    return lines.join('\n');
  }

  for (const v of verdicts) {
    const mark = MARK[v.status];
    const quote = v.claim.subject ?? v.claim.quote;
    const evidence = v.evidence;
    if (opts.color) {
      lines.push(`${ANSI[v.status]}${mark} ${quote}${RESET}`);
      lines.push(`   ${DIM}${evidence}${RESET}`);
    } else {
      lines.push(`${mark} ${quote}`);
      lines.push(`   ${evidence}`);
    }
  }

  const total = verdicts.length;
  const verified = verdicts.filter((v) => v.status === 'verified').length;
  const failed = verdicts.filter((v) => v.status === 'failed').length;
  const unverifiable = verdicts.filter((v) => v.status === 'unverifiable').length;
  const parts = [`${verified} of ${total} claims verified`];
  if (failed > 0) parts.push(`${failed} failed`);
  if (unverifiable > 0) parts.push(`${unverifiable} unverifiable`);
  lines.push('');
  lines.push(parts.join(', ') + '.');
  return lines.join('\n');
}
