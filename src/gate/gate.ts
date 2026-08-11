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

interface GateState {
  bounces: number;
  /** What failed last time, so a repeat can be recognized. */
  lastFailure?: string;
}

function readState(stateDir: string, sessionId: string): GateState {
  try {
    const parsed = JSON.parse(
      readFileSync(join(stateDir, `${sessionId}.json`), 'utf8'),
    ) as GateState;
    return { bounces: typeof parsed.bounces === 'number' ? parsed.bounces : 0, lastFailure: parsed.lastFailure };
  } catch {
    return { bounces: 0 };
  }
}

function writeState(stateDir: string, sessionId: string, state: GateState): void {
  mkdirSync(stateDir, { recursive: true });
  writeFileSync(join(stateDir, `${sessionId}.json`), JSON.stringify(state));
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
    writeState(stateDir, input.sessionId, { bounces: 0 });
    logDecision('allow', 0);
    return { action: 'allow', receipt };
  }

  const state = readState(stateDir, input.sessionId);
  const failureSignature = failed
    .map((v) => `${v.claim.type}|${v.claim.subject ?? ''}|${v.evidence}`)
    .join('\n');

  // Two identical failures in a row mean the diagnosis is wrong, and another
  // bounce would only make a bigger mess. Hand back to the human early.
  if (state.bounces >= 1 && state.lastFailure === failureSignature) {
    logDecision('allow', state.bounces);
    return {
      action: 'allow',
      warning: `nuhuh stopped bouncing: the same claim failed the same way twice in a row, so the fix is going in the wrong direction. Run \`npx nuhuh\` to see the receipt.`,
      receipt,
    };
  }

  if (state.bounces >= input.maxBounces) {
    logDecision('allow', state.bounces);
    return {
      action: 'allow',
      warning: `nuhuh gave up after ${input.maxBounces} bounces with ${failed.length} claim(s) still failing. Run \`npx nuhuh\` to see the receipt.`,
      receipt,
    };
  }
  writeState(stateDir, input.sessionId, {
    bounces: state.bounces + 1,
    lastFailure: failureSignature,
  });
  logDecision('block', state.bounces + 1);

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
