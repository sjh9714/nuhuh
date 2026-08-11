import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { installHook, uninstallHook } from '../src/gate/install.js';

function tmpSettings(): string {
  return join(mkdtempSync(join(tmpdir(), 'nuhuh-install-')), 'settings.json');
}

function read(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
}

describe('installHook', () => {
  test('creates settings.json with the nuhuh Stop hook', () => {
    const path = tmpSettings();
    installHook(path);
    const settings = read(path) as { hooks: { Stop: Array<{ hooks: Array<{ command: string }> }> } };
    const commands = settings.hooks.Stop.flatMap((m) => m.hooks.map((h) => h.command));
    expect(commands.some((c) => c.includes('nuhuh gate'))).toBe(true);
  });

  test('preserves existing settings and hooks, and backs the file up', () => {
    const path = tmpSettings();
    writeFileSync(
      path,
      JSON.stringify({
        model: 'opus',
        hooks: { Stop: [{ hooks: [{ type: 'command', command: 'other-tool audit' }] }] },
      }),
    );
    installHook(path);
    const settings = read(path) as {
      model: string;
      hooks: { Stop: Array<{ hooks: Array<{ command: string }> }> };
    };
    expect(settings.model).toBe('opus');
    const commands = settings.hooks.Stop.flatMap((m) => m.hooks.map((h) => h.command));
    expect(commands).toContain('other-tool audit');
    expect(commands.some((c) => c.includes('nuhuh gate'))).toBe(true);
    expect(existsSync(path + '.nuhuh-backup')).toBe(true);
  });

  test('is idempotent', () => {
    const path = tmpSettings();
    installHook(path);
    installHook(path);
    const settings = read(path) as { hooks: { Stop: Array<{ hooks: Array<{ command: string }> }> } };
    const ours = settings.hooks.Stop.flatMap((m) => m.hooks).filter((h) =>
      h.command.includes('nuhuh gate'),
    );
    expect(ours).toHaveLength(1);
  });
});

describe('uninstallHook', () => {
  test('removes only the nuhuh hook', () => {
    const path = tmpSettings();
    writeFileSync(
      path,
      JSON.stringify({
        hooks: { Stop: [{ hooks: [{ type: 'command', command: 'other-tool audit' }] }] },
      }),
    );
    installHook(path);
    uninstallHook(path);
    const settings = read(path) as { hooks: { Stop: Array<{ hooks: Array<{ command: string }> }> } };
    const commands = settings.hooks.Stop.flatMap((m) => m.hooks.map((h) => h.command));
    expect(commands).toContain('other-tool audit');
    expect(commands.some((c) => c.includes('nuhuh gate'))).toBe(false);
  });

  test('is a no-op when nothing is installed', () => {
    const path = tmpSettings();
    writeFileSync(path, JSON.stringify({ model: 'opus' }));
    expect(() => uninstallHook(path)).not.toThrow();
    expect(read(path)).toEqual({ model: 'opus' });
  });
});
