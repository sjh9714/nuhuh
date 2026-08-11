import { mkdtempSync, mkdirSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import {
  encodeCwd,
  findLatestSession,
  lastAssistantText,
} from '../src/transcript/claude-code.js';

function jsonl(lines: object[]): string {
  return lines.map((l) => JSON.stringify(l)).join('\n') + '\n';
}

function assistantLine(text: string, extra: object = {}): object {
  return {
    type: 'assistant',
    timestamp: '2026-08-11T04:00:00.000Z',
    sessionId: 's1',
    message: { role: 'assistant', content: [{ type: 'text', text }] },
    ...extra,
  };
}

describe('lastAssistantText', () => {
  test('returns the text of the last assistant text message', () => {
    const dir = mkdtempSync(join(tmpdir(), 'nuhuh-'));
    const file = join(dir, 's1.jsonl');
    writeFileSync(
      file,
      jsonl([
        { type: 'user', message: { role: 'user', content: 'do the thing' } },
        assistantLine('Working on it.'),
        assistantLine('Done! All tests pass.'),
      ]),
    );
    expect(lastAssistantText(file)?.text).toBe('Done! All tests pass.');
  });

  test('skips assistant messages that contain only tool_use blocks', () => {
    const dir = mkdtempSync(join(tmpdir(), 'nuhuh-'));
    const file = join(dir, 's1.jsonl');
    writeFileSync(
      file,
      jsonl([
        assistantLine('Done! Created `a.ts`.'),
        {
          type: 'assistant',
          message: { role: 'assistant', content: [{ type: 'tool_use', name: 'Bash', input: {} }] },
        },
      ]),
    );
    expect(lastAssistantText(file)?.text).toBe('Done! Created `a.ts`.');
  });

  test('skips sidechain (subagent) messages', () => {
    const dir = mkdtempSync(join(tmpdir(), 'nuhuh-'));
    const file = join(dir, 's1.jsonl');
    writeFileSync(
      file,
      jsonl([
        assistantLine('Main answer.'),
        assistantLine('Subagent chatter.', { isSidechain: true }),
      ]),
    );
    expect(lastAssistantText(file)?.text).toBe('Main answer.');
  });

  test('returns null when there is no assistant text', () => {
    const dir = mkdtempSync(join(tmpdir(), 'nuhuh-'));
    const file = join(dir, 's1.jsonl');
    writeFileSync(file, jsonl([{ type: 'user', message: {} }]));
    expect(lastAssistantText(file)).toBeNull();
  });

  test('tolerates malformed lines', () => {
    const dir = mkdtempSync(join(tmpdir(), 'nuhuh-'));
    const file = join(dir, 's1.jsonl');
    writeFileSync(file, 'not json at all\n' + jsonl([assistantLine('Fine.')]) + '{broken\n');
    expect(lastAssistantText(file)?.text).toBe('Fine.');
  });
});

describe('findLatestSession', () => {
  test('finds the newest session file for an exact project dir', () => {
    const projects = mkdtempSync(join(tmpdir(), 'nuhuh-projects-'));
    const cwd = '/Users/x/proj';
    const encoded = encodeCwd(cwd);
    const projDir = join(projects, encoded);
    mkdirSync(projDir);
    // a lookalike dir that merely starts with the encoded name must not match
    mkdirSync(join(projects, `${encoded}-scratchpad-extra`));
    writeFileSync(join(projects, `${encoded}-scratchpad-extra`, 'zz.jsonl'), '');

    const oldFile = join(projDir, 'old.jsonl');
    const newFile = join(projDir, 'new.jsonl');
    writeFileSync(oldFile, '');
    writeFileSync(newFile, '');
    utimesSync(oldFile, new Date('2026-01-01'), new Date('2026-01-01'));
    utimesSync(newFile, new Date('2026-08-01'), new Date('2026-08-01'));

    expect(findLatestSession(projects, cwd)).toBe(newFile);
  });

  test('returns null when the project has no sessions', () => {
    const projects = mkdtempSync(join(tmpdir(), 'nuhuh-projects-'));
    expect(findLatestSession(projects, '/Users/x/nothing')).toBeNull();
  });
});
