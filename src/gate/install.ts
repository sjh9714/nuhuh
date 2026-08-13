import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The hook is pinned to the version that installed it. An unpinned command
 * would fetch whatever npm serves that day, so a tool that exists to make
 * runs reproducible would itself run mutable code on every stop. Moving to a
 * newer nuhuh is then a deliberate `nuhuh uninit && npx nuhuh@x.y.z init`.
 */
function installedVersion(): string {
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    // dist/index.js at runtime, src/gate/ in tests, so try both roots
    for (const rel of ['../package.json', '../../package.json', '../../../package.json']) {
      try {
        const pkg = JSON.parse(readFileSync(join(here, rel), 'utf8')) as { name?: string; version?: string };
        if (pkg.name === 'nuhuh' && pkg.version) return pkg.version;
      } catch {
        // try the next root
      }
    }
  } catch {
    // fall through
  }
  return 'latest';
}

const GATE_COMMAND = `npx --yes nuhuh@${installedVersion()} gate`;
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

/** Matches our hook whatever version it was pinned to, including unpinned old ones. */
const OURS = /\bnuhuh(?:@[\w.\-]+)?\s+gate\b/;

function isOurs(hook: HookEntry): boolean {
  return OURS.test(hook.command);
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
