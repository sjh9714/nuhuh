import { readFileSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { AssistantText } from './claude-code.js';

export function defaultCodexHome(): string {
  return join(homedir(), '.codex');
}

interface RolloutLine {
  type?: string;
  payload?: {
    type?: string;
    role?: string;
    cwd?: string;
    content?: Array<{ type?: string; text?: string }>;
  };
}

function parseLines(file: string): RolloutLine[] {
  let raw: string;
  try {
    raw = readFileSync(file, 'utf8');
  } catch {
    return [];
  }
  const lines: RolloutLine[] = [];
  for (const line of raw.split('\n')) {
    if (line.trim().length === 0) continue;
    try {
      lines.push(JSON.parse(line) as RolloutLine);
    } catch {
      // tolerate torn writes
    }
  }
  return lines;
}

export function lastCodexAssistantText(file: string): AssistantText | null {
  let result: AssistantText | null = null;
  for (const line of parseLines(file)) {
    const p = line.payload;
    if (line.type !== 'response_item' || p?.type !== 'message' || p.role !== 'assistant') continue;
    if (!Array.isArray(p.content)) continue;
    const text = p.content
      .filter((b) => b.type === 'output_text' && typeof b.text === 'string')
      .map((b) => b.text as string)
      .join('\n')
      .trim();
    if (text.length > 0) result = { text };
  }
  return result;
}

function sessionCwd(file: string): string | null {
  for (const line of parseLines(file)) {
    if ((line.type === 'session_meta' || line.type === 'turn_context') && line.payload?.cwd) {
      return line.payload.cwd;
    }
  }
  return null;
}

function collectRollouts(dir: string, out: string[], depth: number): void {
  if (depth > 4) return;
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    const path = join(dir, entry);
    try {
      const stat = statSync(path);
      if (stat.isDirectory()) collectRollouts(path, out, depth + 1);
      else if (entry.startsWith('rollout-') && entry.endsWith('.jsonl')) out.push(path);
    } catch {
      // skip unreadable entries
    }
  }
}

/**
 * Newest Codex rollout whose recorded cwd matches. Only the most recent files
 * are opened, so a large session history stays cheap to scan.
 */
export function findLatestCodexSession(codexHome: string, cwd: string): string | null {
  const rollouts: string[] = [];
  for (const dir of ['sessions', 'archived_sessions']) {
    collectRollouts(join(codexHome, dir), rollouts, 0);
  }
  const newestFirst = rollouts
    .map((file) => {
      try {
        return { file, mtime: statSync(file).mtimeMs };
      } catch {
        return { file, mtime: 0 };
      }
    })
    .sort((a, b) => b.mtime - a.mtime)
    .slice(0, 25);
  for (const { file } of newestFirst) {
    if (sessionCwd(file) === cwd) return file;
  }
  return null;
}
