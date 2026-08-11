import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { findLatestCodexSession, lastCodexAssistantText } from '../src/transcript/codex.js';

function jsonl(lines: object[]): string {
  return lines.map((l) => JSON.stringify(l)).join('\n') + '\n';
}

function rollout(cwd: string, texts: string[]): string {
  return jsonl([
    { type: 'session_meta', payload: { cwd } },
    { type: 'turn_context', payload: { cwd } },
    ...texts.map((text) => ({
      type: 'response_item',
      payload: { type: 'message', role: 'assistant', content: [{ type: 'output_text', text }] },
    })),
    {
      type: 'response_item',
      payload: { type: 'function_call', name: 'shell' },
    },
  ]);
}

describe('lastCodexAssistantText', () => {
  test('returns the last assistant output_text', () => {
    const dir = mkdtempSync(join(tmpdir(), 'nuhuh-codex-'));
    const file = join(dir, 'rollout-1.jsonl');
    writeFileSync(file, rollout('/p', ['working…', 'Done! All tests pass.']));
    expect(lastCodexAssistantText(file)?.text).toBe('Done! All tests pass.');
  });

  test('returns null when there is no assistant message', () => {
    const dir = mkdtempSync(join(tmpdir(), 'nuhuh-codex-'));
    const file = join(dir, 'rollout-1.jsonl');
    writeFileSync(file, jsonl([{ type: 'session_meta', payload: { cwd: '/p' } }]));
    expect(lastCodexAssistantText(file)).toBeNull();
  });
});

describe('findLatestCodexSession', () => {
  test('finds the newest rollout whose session cwd matches', () => {
    const home = mkdtempSync(join(tmpdir(), 'nuhuh-codex-home-'));
    const sessions = join(home, 'sessions', '2026', '08', '11');
    mkdirSync(sessions, { recursive: true });
    writeFileSync(join(sessions, 'rollout-a.jsonl'), rollout('/other/project', ['no']));
    writeFileSync(join(sessions, 'rollout-b.jsonl'), rollout('/my/project', ['yes']));
    const found = findLatestCodexSession(home, '/my/project');
    expect(found).toBe(join(sessions, 'rollout-b.jsonl'));
  });

  test('returns null when nothing matches', () => {
    const home = mkdtempSync(join(tmpdir(), 'nuhuh-codex-home-'));
    expect(findLatestCodexSession(home, '/my/project')).toBeNull();
  });
});
