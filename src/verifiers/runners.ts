import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

export type ScriptKind = 'test' | 'build' | 'lint';

export interface DetectedCommand {
  command: string;
  /** Which manifest chose the command, so the receipt can say why it ran. */
  source: string;
}

const NPM_PLACEHOLDER_TEST = /echo\s+["']?Error: no test specified/i;

interface PackageJson {
  scripts?: Record<string, string>;
}

function exists(cwd: string, file: string): boolean {
  try {
    statSync(join(cwd, file));
    return true;
  } catch {
    return false;
  }
}

function readIfThere(cwd: string, file: string): string | null {
  try {
    return readFileSync(join(cwd, file), 'utf8');
  } catch {
    return null;
  }
}

function detectPackageManager(cwd: string): string {
  const lockfiles: Array<[string, string]> = [
    ['pnpm-lock.yaml', 'pnpm'],
    ['yarn.lock', 'yarn'],
    ['bun.lockb', 'bun'],
    ['bun.lock', 'bun'],
  ];
  for (const [file, pm] of lockfiles) {
    if (exists(cwd, file)) return pm;
  }
  return 'npm';
}

function fromPackageJson(cwd: string, kind: ScriptKind): DetectedCommand | null {
  const raw = readIfThere(cwd, 'package.json');
  if (raw === null) return null;
  let pkg: PackageJson;
  try {
    pkg = JSON.parse(raw) as PackageJson;
  } catch {
    return null;
  }
  const script = pkg.scripts?.[kind];
  if (!script) return null;
  if (kind === 'test' && NPM_PLACEHOLDER_TEST.test(script)) return null;
  const pm = detectPackageManager(cwd);
  const command = kind === 'test' && pm === 'npm' ? 'npm test' : `${pm} run ${kind}`;
  return { command, source: 'package.json' };
}

function fromGoModule(cwd: string, kind: ScriptKind): DetectedCommand | null {
  if (!exists(cwd, 'go.mod')) return null;
  const commands: Record<ScriptKind, string> = {
    test: 'go test ./...',
    build: 'go build ./...',
    lint: 'go vet ./...',
  };
  return { command: commands[kind], source: 'go.mod' };
}

function fromCargoCrate(cwd: string, kind: ScriptKind): DetectedCommand | null {
  if (!exists(cwd, 'Cargo.toml')) return null;
  // clippy is an optional component, so lint has no safe cargo command.
  if (kind === 'lint') return null;
  return { command: kind === 'test' ? 'cargo test' : 'cargo build', source: 'Cargo.toml' };
}

function fromPytestConfig(cwd: string, kind: ScriptKind): DetectedCommand | null {
  if (kind !== 'test') return null;
  const configured =
    exists(cwd, 'pytest.ini') ||
    exists(cwd, 'conftest.py') ||
    (readIfThere(cwd, 'pyproject.toml')?.includes('[tool.pytest') ?? false) ||
    (readIfThere(cwd, 'setup.cfg')?.includes('[tool:pytest]') ?? false);
  return configured ? { command: 'pytest', source: 'pytest config' } : null;
}

function fromGradleWrapper(cwd: string, kind: ScriptKind): DetectedCommand | null {
  // Only the project's own wrapper counts. A global gradle is not manifest-blessed.
  if (kind === 'lint') return null;
  if (process.platform === 'win32') {
    if (!exists(cwd, 'gradlew.bat')) return null;
    return { command: `gradlew.bat ${kind}`, source: 'gradle wrapper' };
  }
  if (!exists(cwd, 'gradlew')) return null;
  return { command: `./gradlew ${kind}`, source: 'gradle wrapper' };
}

/**
 * Pick the fresh command for a claim kind from the project's own manifests.
 * The first matching toolchain wins, and package.json always wins over the
 * rest so an explicit script keeps its authority.
 */
export function detectCommand(cwd: string, kind: ScriptKind): DetectedCommand | null {
  return (
    fromPackageJson(cwd, kind) ??
    fromGoModule(cwd, kind) ??
    fromCargoCrate(cwd, kind) ??
    fromPytestConfig(cwd, kind) ??
    fromGradleWrapper(cwd, kind)
  );
}
