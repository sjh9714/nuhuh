import { execFileSync } from 'node:child_process';

/**
 * A test that no longer runs cannot fail. This scans what the session changed
 * (uncommitted work, staged and unstaged) for newly added skip/only markers in
 * test files, the classic way a suite gets to green without getting fixed.
 *
 * Findings are notes, not verdicts: skipping a test is sometimes exactly what
 * the human asked for. The receipt shows them; it does not accuse.
 */

const SKIP_MARKERS: Array<[RegExp, string]> = [
  [/\.(?:skip|only|todo|failing)\s*\(/, '.skip/.only'],
  [/\b(?:xit|xdescribe|xtest)\s*\(/, 'xit/xdescribe'],
  [/@pytest\.mark\.skip/, '@pytest.mark.skip'],
  [/#\[\s*ignore\s*\]/, '#[ignore]'],
  [/\bt\.Skip\s*\(/, 't.Skip'],
];

const TEST_FILE = /(?:^|\/)(?:test|tests|spec|__tests__)(?:\/|_|\.)|[._-](?:test|spec)\.[\w]+$|^test_[^/]+\.py$|(?:^|\/)test_[^/]+\.py$/i;

function gitDiff(cwd: string): string | null {
  try {
    return execFileSync('git', ['diff', 'HEAD', '--unified=0', '--no-color'], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      maxBuffer: 10 * 1024 * 1024,
    });
  } catch {
    return null;
  }
}

function markerIn(line: string): string | null {
  for (const [pattern, label] of SKIP_MARKERS) {
    if (pattern.test(line)) return label;
  }
  return null;
}

export function censusFindings(cwd: string): string[] {
  const diff = gitDiff(cwd);
  if (diff === null) return [];

  const findings: string[] = [];
  let currentFile: string | null = null;
  for (const line of diff.split('\n')) {
    const fileHeader = line.match(/^\+\+\+ b\/(.+)$/);
    if (fileHeader?.[1]) {
      currentFile = fileHeader[1];
      continue;
    }
    if (!currentFile || !TEST_FILE.test(currentFile)) continue;
    if (!line.startsWith('+') || line.startsWith('+++')) continue;
    const marker = markerIn(line.slice(1));
    if (marker) {
      findings.push(`this session added ${marker} in ${currentFile}`);
    }
  }
  return findings;
}
