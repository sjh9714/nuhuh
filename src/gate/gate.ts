import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { verifyMessage } from '../app.js';
import { lastAssistantText } from '../transcript/claude-code.js';
import { appendDecision, defaultLogDir } from './decision-log.js';

export interface GateInput {
  transcriptPath: string;
  cwd: string;
  sessionId: string;
  stopHookActive: boolean;
  maxBounces: number;
  /** Where bounce counts are kept; defaults to ~/.nuhuh/state. */
  stateDir?: string;
  /** Where the decision log lives; defaults to ~/.nuhuh. */
  logDir?: string;
  env: Record<string, string | undefined>;
  timeoutMs?: number;
}

export interface GateDecision {
  action: 'allow' | 'block';
  /** Fed back to the agent when blocking: the failing evidence and what to do. */
  reason?: string;
  /** Surfaced to the human when allowing despite failures (gave up bouncing). */
  warning?: string;
  receipt?: string;
}

export function defaultStateDir(): string {
  return join(homedir(), '.nuhuh', 'state');
}

function readBounces(stateDir: string, sessionId: string): number {
  try {
    const parsed = JSON.parse(
      readFileSync(join(stateDir, `${sessionId}.json`), 'utf8'),
    ) as { bounces?: number };
    return typeof parsed.bounces === 'number' ? parsed.bounces : 0;
  } catch {
    return 0;
  }
}

function writeBounces(stateDir: string, sessionId: string, bounces: number): void {
  mkdirSync(stateDir, { recursive: true });
  writeFileSync(join(stateDir, `${sessionId}.json`), JSON.stringify({ bounces }));
}

export async function decideGate(input: GateInput): Promise<GateDecision> {
  if (input.env['NUHUH_OFF'] === '1') {
    return { action: 'allow' };
  }
  const stateDir = input.stateDir ?? defaultStateDir();

  const last = lastAssistantText(input.transcriptPath);
  if (!last) return { action: 'allow' };

  const { verdicts, receipt } = await verifyMessage(last.text, {
    cwd: input.cwd,
    color: false,
    timeoutMs: input.timeoutMs,
  });
  const logDecision = (action: 'allow' | 'block', bounces: number) => {
    if (verdicts.length === 0) return;
    appendDecision(input.logDir ?? defaultLogDir(), {
      at: new Date().toISOString(),
      sessionId: input.sessionId,
      cwd: input.cwd,
      action,
      bounces,
      verdicts: verdicts.map((v) => ({
        type: v.claim.type,
        status: v.status,
        evidence: v.evidence,
      })),
    });
  };
  const failed = verdicts.filter((v) => v.status === 'failed');
  if (failed.length === 0) {
    writeBounces(stateDir, input.sessionId, 0);
    logDecision('allow', 0);
    return { action: 'allow', receipt };
  }

  const bounces = readBounces(stateDir, input.sessionId);
  if (bounces >= input.maxBounces) {
    logDecision('allow', bounces);
    return {
      action: 'allow',
      warning: `nuhuh gave up after ${input.maxBounces} bounces with ${failed.length} claim(s) still failing. Run \`npx nuhuh\` to see the receipt.`,
      receipt,
    };
  }
  writeBounces(stateDir, input.sessionId, bounces + 1);
  logDecision('block', bounces + 1);

  const evidence = failed
    .map((v) => `- you said "${v.claim.quote}" and reality says ${v.evidence}`)
    .join('\n');
  return {
    action: 'block',
    reason:
      `nuhuh checked your completion claims against reality and ${failed.length} of them failed.\n` +
      `${evidence}\n` +
      `Fix the work until these claims are actually true, then finish. ` +
      `Do not weaken or delete checks to make them pass.`,
    receipt,
  };
}
