import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';

export interface RunResult {
  exitCode: number | null;
  timedOut: boolean;
  output: string;
  outputHash: string;
  summaryLine: string;
}

/**
 * Run a command fresh in its own process. The command strings are always
 * chosen by nuhuh from project manifests — never taken from claim text —
 * so the agent being scored cannot author what gets executed.
 */
export function runCommand(
  command: string,
  cwd: string,
  timeoutMs = 120_000,
): Promise<RunResult> {
  return new Promise((resolvePromise) => {
    const child = spawn(command, {
      cwd,
      shell: true,
      env: { ...process.env, NUHUH: '1', CI: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, timeoutMs);

    const collect = (chunk: Buffer) => {
      // Cap retained output so a chatty test run cannot balloon memory.
      if (output.length < 1_000_000) output += chunk.toString();
    };
    child.stdout.on('data', collect);
    child.stderr.on('data', collect);

    child.on('close', (code) => {
      clearTimeout(timer);
      const lines = output
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0);
      resolvePromise({
        exitCode: code,
        timedOut,
        output,
        outputHash: createHash('sha256').update(output).digest('hex').slice(0, 12),
        summaryLine: (lines[lines.length - 1] ?? '').slice(0, 160),
      });
    });
    child.on('error', () => {
      clearTimeout(timer);
      resolvePromise({
        exitCode: null,
        timedOut,
        output,
        outputHash: createHash('sha256').update(output).digest('hex').slice(0, 12),
        summaryLine: 'command failed to start',
      });
    });
  });
}
