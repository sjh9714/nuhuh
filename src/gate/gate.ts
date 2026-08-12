import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { verifyMessage } from '../app.js';
import { DONE_WORDS } from '../claims/patterns.js';
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

/**
 * What the Stop hook should print for a decision, or null for silence.
 * By default a clean allow is silent to keep bounces cheap in context.
 * NUHUH_RECEIPT=always surfaces the success receipt too, so the agent never
 * learns that a green sentence is enough on its own (suggested by a
 * launch-article commenter, issue 8).
 */
export function renderGateOutput(
  decision: GateDecision,
  env: Record<string, string | undefined>,
): string | null {
  if (decision.action === 'block' && decision.reason) {
    return JSON.stringify({ decision: 'block', reason: decision.reason });
  }
  const wantReceipt = env['NUHUH_RECEIPT'] === 'always' && decision.receipt;
  if (decision.warning) {
    const message = wantReceipt ? `${decision.warning}\n\n${decision.receipt}` : decision.warning;
    return JSON.stringify({ systemMessage: message });
  }
  if (wantReceipt) {
    return JSON.stringify({ systemMessage: decision.receipt });
  }
  return null;
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
  // The measured blind spot of claim verification: every false Done in the
  // benchmark carried zero checkable claims. Strict mode (opt-in) bounces a
  // completion declaration that gives the verifier nothing to grab.
  const claimlessDone =
    input.env['NUHUH_STRICT'] === '1' && verdicts.length === 0 && DONE_WORDS.test(last.text);
  if (failed.length === 0 && !claimlessDone) {
    writeState(stateDir, input.sessionId, { bounces: 0 });
    logDecision('allow', 0);
    // A receipt with zero checkable claims would be pure noise on every stop,
    // so the allow only carries one when something was actually verified.
    return verdicts.length > 0 ? { action: 'allow', receipt } : { action: 'allow' };
  }

  const state = readState(stateDir, input.sessionId);
  const failureSignature =
    failed.length > 0
      ? failed
          .map((v) => `${v.claim.type}|${v.claim.subject ?? ''}|${v.evidence}`)
          .join('\n')
      : 'claimless-done';

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

  if (failed.length === 0) {
    // strict claimless-done bounce
    return {
      action: 'block',
      reason:
        `You declared completion but made no checkable claim, so nuhuh has nothing to verify.\n` +
        `State what is true in checkable terms (tests pass, file created, endpoint responds) or show the evidence, then finish.`,
      receipt,
    };
  }

  // A chatty deny reason on a hook that fires repeatedly becomes a recurring
  // context tax, so the reason stays at two lines: the first failure with its
  // evidence, a count of the rest, and the ground rules.
  const first = failed[0];
  const more = failed.length > 1 ? ` (${failed.length - 1} more failed, run \`npx nuhuh\` for the full receipt)` : '';
  return {
    action: 'block',
    reason:
      `nuhuh re-ran your claim "${first?.claim.quote}" and reality says ${first?.evidence}${more}.\n` +
      `Fix the work until the claims are actually true, then finish. Do not weaken or delete checks to make them pass.`,
    receipt,
  };
}
