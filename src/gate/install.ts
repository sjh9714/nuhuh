import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const GATE_COMMAND = 'npx --yes nuhuh gate';
/** Long enough for a real test suite; the Stop hook default would cut it off. */
const GATE_TIMEOUT_SECONDS = 600;

interface HookEntry {
  type: string;
  command: string;
  timeout?: number;
}

interface HookMatcher {
  matcher?: string;
  hooks: HookEntry[];
}

interface Settings {
  hooks?: Record<string, HookMatcher[]>;
  [key: string]: unknown;
}

function readSettings(path: string): Settings {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as Settings;
  } catch {
    return {};
  }
}

function isOurs(hook: HookEntry): boolean {
  return hook.command.includes('nuhuh gate');
}

export function installHook(settingsPath: string): void {
  const existed = existsSync(settingsPath);
  const settings = readSettings(settingsPath);
  const stop: HookMatcher[] = settings.hooks?.['Stop'] ?? [];

  const alreadyInstalled = stop.some((m) => m.hooks.some(isOurs));
  if (alreadyInstalled) return;

  if (existed) copyFileSync(settingsPath, settingsPath + '.nuhuh-backup');

  stop.push({
    hooks: [{ type: 'command', command: GATE_COMMAND, timeout: GATE_TIMEOUT_SECONDS }],
  });
  settings.hooks = { ...settings.hooks, Stop: stop };
  mkdirSync(dirname(settingsPath), { recursive: true });
  writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
}

export function uninstallHook(settingsPath: string): void {
  if (!existsSync(settingsPath)) return;
  const settings = readSettings(settingsPath);
  const stop = settings.hooks?.['Stop'];
  if (!stop) return;

  const cleaned = stop
    .map((m) => ({ ...m, hooks: m.hooks.filter((h) => !isOurs(h)) }))
    .filter((m) => m.hooks.length > 0);

  if (settings.hooks) {
    if (cleaned.length > 0) {
      settings.hooks['Stop'] = cleaned;
    } else {
      delete settings.hooks['Stop'];
      if (Object.keys(settings.hooks).length === 0) delete settings.hooks;
    }
  }
  writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
}
