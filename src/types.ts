export type ClaimType =
  | 'tests-pass'
  | 'file-created'
  | 'build-pass'
  | 'endpoint-works'
  | 'env-set'
  | 'negative-existence';

export interface Claim {
  type: ClaimType;
  /** The exact sentence in the agent's message the claim was extracted from. */
  quote: string;
  /** What the claim is about, when the sentence names one (e.g. a file path). */
  subject?: string;
}

/**
 * verified     — nuhuh reproduced the claim against reality.
 * failed       — nuhuh ran the experiment and reality disagreed.
 * unverifiable — nuhuh has no safe way to check this claim; never treated as failed.
 */
export type VerdictStatus = 'verified' | 'failed' | 'unverifiable';

export interface Verdict {
  claim: Claim;
  status: VerdictStatus;
  /** Human-readable, single line: what was checked and what reality said. */
  evidence: string;
  /** The exact command that was run fresh, when one was. */
  command?: string;
  exitCode?: number;
  /** sha256 (first 12 hex chars) of the captured output, for reproducibility. */
  outputHash?: string;
}

export interface VerifyContext {
  cwd: string;
  /** Per-command timeout in milliseconds. A timeout is unverifiable, never failed. */
  timeoutMs?: number;
}
