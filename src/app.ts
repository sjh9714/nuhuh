import { extractClaims } from './claims/extract.js';
import { renderReceipt } from './receipt/render.js';
import {
  defaultProjectsDir,
  findLatestSession,
  lastAssistantText,
} from './transcript/claude-code.js';
import {
  defaultCodexHome,
  findLatestCodexSession,
  lastCodexAssistantText,
} from './transcript/codex.js';
import type { Verdict } from './types.js';
import { verifyClaim } from './verifiers/index.js';

export interface PostHocOptions {
  cwd: string;
  projectsDir?: string;
  codexHome?: string;
  color?: boolean;
  timeoutMs?: number;
}

export interface PostHocResult {
  /** 0 = nothing failed, 1 = at least one claim failed the experiment. */
  exitCode: 0 | 1;
  receipt: string;
  verdicts: Verdict[];
  /** The agent message the claims came from, when one was found. */
  message?: string;
}

export async function verifyMessage(
  message: string,
  opts: { cwd: string; color?: boolean; timeoutMs?: number },
): Promise<{ verdicts: Verdict[]; receipt: string; exitCode: 0 | 1 }> {
  const claims = extractClaims(message);
  const verdicts: Verdict[] = [];
  for (const claim of claims) {
    verdicts.push(await verifyClaim(claim, { cwd: opts.cwd, timeoutMs: opts.timeoutMs }));
  }
  const receipt = renderReceipt(verdicts, { color: opts.color ?? false });
  const exitCode = verdicts.some((v) => v.status === 'failed') ? 1 : 0;
  return { verdicts, receipt, exitCode };
}

export async function postHoc(opts: PostHocOptions): Promise<PostHocResult> {
  const projectsDir = opts.projectsDir ?? defaultProjectsDir();
  const session = findLatestSession(projectsDir, opts.cwd);
  let last = session ? lastAssistantText(session) : null;
  if (!last) {
    const codexSession = findLatestCodexSession(opts.codexHome ?? defaultCodexHome(), opts.cwd);
    if (codexSession) last = lastCodexAssistantText(codexSession);
  }
  if (!last) {
    return {
      exitCode: 0,
      verdicts: [],
      receipt: `no Claude Code or Codex session found for ${opts.cwd} — nothing to check.`,
    };
  }
  const { verdicts, receipt, exitCode } = await verifyMessage(last.text, {
    cwd: opts.cwd,
    color: opts.color,
    timeoutMs: opts.timeoutMs,
  });
  return { exitCode, verdicts, receipt, message: last.text };
}
