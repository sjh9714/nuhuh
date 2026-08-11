import { readFileSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export interface AssistantText {
  text: string;
  timestamp?: string;
  sessionId?: string;
}

/** Claude Code encodes a project cwd into a directory name under ~/.claude/projects. */
export function encodeCwd(cwd: string): string {
  return cwd.replace(/[^a-zA-Z0-9-]/g, '-');
}

export function defaultProjectsDir(): string {
  return join(homedir(), '.claude', 'projects');
}

/** Newest session transcript for the project at `cwd`, or null when none exists. */
export function findLatestSession(projectsDir: string, cwd: string): string | null {
  const dir = join(projectsDir, encodeCwd(cwd));
  let entries: string[];
  try {
    entries = readdirSync(dir).filter((f) => f.endsWith('.jsonl'));
  } catch {
    return null;
  }
  let newest: string | null = null;
  let newestMtime = -Infinity;
  for (const entry of entries) {
    const file = join(dir, entry);
    try {
      const mtime = statSync(file).mtimeMs;
      if (mtime > newestMtime) {
        newestMtime = mtime;
        newest = file;
      }
    } catch {
      // file vanished between readdir and stat; skip it
    }
  }
  return newest;
}

interface ContentBlock {
  type?: string;
  text?: string;
}

/**
 * The last main-conversation assistant message that contains text.
 * Sidechain (subagent) messages and tool_use-only messages are skipped.
 */
export function lastAssistantText(file: string): AssistantText | null {
  let raw: string;
  try {
    raw = readFileSync(file, 'utf8');
  } catch {
    return null;
  }
  let result: AssistantText | null = null;
  for (const line of raw.split('\n')) {
    if (line.trim().length === 0) continue;
    let entry: Record<string, unknown>;
    try {
      entry = JSON.parse(line) as Record<string, unknown>;
    } catch {
      continue;
    }
    if (entry['type'] !== 'assistant' || entry['isSidechain'] === true) continue;
    const message = entry['message'] as { content?: unknown } | undefined;
    const content = message?.content;
    if (!Array.isArray(content)) continue;
    const text = (content as ContentBlock[])
      .filter((b) => b.type === 'text' && typeof b.text === 'string')
      .map((b) => b.text as string)
      .join('\n')
      .trim();
    if (text.length === 0) continue;
    result = {
      text,
      timestamp: typeof entry['timestamp'] === 'string' ? entry['timestamp'] : undefined,
      sessionId: typeof entry['sessionId'] === 'string' ? entry['sessionId'] : undefined,
    };
  }
  return result;
}
