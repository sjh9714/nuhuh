import { appendFileSync, mkdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

/**
 * An append-only record of what the gate actually did, so "what happened
 * last month" doesn't require digging through session transcripts.
 * Evidence strings are already value-masked before they get here.
 */

export interface DecisionEntry {
  at: string;
  sessionId: string;
  cwd: string;
  action: 'allow' | 'block';
  bounces: number;
  verdicts: Array<{ type: string; status: string; evidence: string }>;
}

export function defaultLogDir(): string {
  return join(homedir(), '.nuhuh');
}

function logFile(logDir: string): string {
  return join(logDir, 'log.jsonl');
}

export function appendDecision(logDir: string, entry: DecisionEntry): void {
  try {
    mkdirSync(logDir, { recursive: true });
    appendFileSync(logFile(logDir), JSON.stringify(entry) + '\n');
  } catch {
    // The log is a convenience. It must never break a session.
  }
}

export function readDecisionLog(logDir: string): DecisionEntry[] {
  let raw: string;
  try {
    raw = readFileSync(logFile(logDir), 'utf8');
  } catch {
    return [];
  }
  const entries: DecisionEntry[] = [];
  for (const line of raw.split('\n')) {
    if (line.trim().length === 0) continue;
    try {
      entries.push(JSON.parse(line) as DecisionEntry);
    } catch {
      // tolerate torn writes
    }
  }
  return entries;
}

export function renderDecisionLog(entries: DecisionEntry[]): string {
  if (entries.length === 0) {
    return 'no gate decisions recorded yet. the log fills up once the gate is installed and claims get checked.';
  }
  const lines: string[] = [];
  for (const entry of entries) {
    const failed = entry.verdicts.filter((v) => v.status === 'failed');
    const summary =
      failed.length > 0
        ? failed.map((v) => v.evidence).join(' / ')
        : `${entry.verdicts.length} claim(s) verified`;
    lines.push(`${entry.at}  ${entry.action.padEnd(5)}  ${summary}`);
  }
  return lines.join('\n');
}
