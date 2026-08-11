#!/usr/bin/env node
import { homedir } from 'node:os';
import { join } from 'node:path';
import { postHoc } from './app.js';
import { runDemo } from './demo.js';
import { decideGate } from './gate/gate.js';
import { installHook, uninstallHook } from './gate/install.js';

function hasFlag(args: string[], flag: string): boolean {
  return args.includes(flag);
}

const HELP = `nuhuh. your agent said Done, and nuhuh runs the experiment.

commands
  nuhuh            verify the completion claims of the latest Claude Code
                   session for this directory, against reality, fresh
  nuhuh demo       watch nuhuh catch a staged false "Done" (no setup needed)
  nuhuh init       install the completion gate for this project
                   (--global for every project on this machine)
  nuhuh uninit     remove the gate again
  nuhuh gate       used by the Stop hook, reads hook JSON on stdin
  nuhuh --json     machine-readable verdicts
  nuhuh --no-color plain output

pause it any time with NUHUH_OFF=1
exit code 0 means nothing failed, 1 means a claim failed the experiment, 2 means usage error
`;

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf8');
}

interface StopHookInput {
  session_id?: string;
  transcript_path?: string;
  cwd?: string;
  stop_hook_active?: boolean;
}

/** Never break the user's session: any internal error allows the stop. */
async function runGate(): Promise<number> {
  let input: StopHookInput;
  try {
    input = JSON.parse(await readStdin()) as StopHookInput;
  } catch {
    return 0;
  }
  if (!input.transcript_path) return 0;
  try {
    const decision = await decideGate({
      transcriptPath: input.transcript_path,
      cwd: input.cwd ?? process.cwd(),
      sessionId: input.session_id ?? 'unknown-session',
      stopHookActive: input.stop_hook_active === true,
      maxBounces: 3,
      env: process.env,
    });
    if (decision.action === 'block' && decision.reason) {
      process.stdout.write(JSON.stringify({ decision: 'block', reason: decision.reason }) + '\n');
    } else if (decision.warning) {
      process.stdout.write(JSON.stringify({ systemMessage: decision.warning }) + '\n');
    }
    return 0;
  } catch {
    return 0;
  }
}

function settingsPath(global: boolean): string {
  return global
    ? join(homedir(), '.claude', 'settings.json')
    : join(process.cwd(), '.claude', 'settings.json');
}

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const color = !hasFlag(args, '--no-color') && process.stdout.isTTY === true;
  const json = hasFlag(args, '--json');
  const command = args.find((a) => !a.startsWith('-'));

  if (hasFlag(args, '--help') || hasFlag(args, '-h')) {
    process.stdout.write(HELP);
    return 0;
  }

  if (command === 'demo') {
    const { receipt, exitCode, message } = await runDemo({ color });
    process.stdout.write(`what the "agent" said\n\n  ${message}\n\n${receipt}\n`);
    return exitCode;
  }

  if (command === 'gate') {
    return runGate();
  }

  if (command === 'init') {
    const path = settingsPath(hasFlag(args, '--global'));
    installHook(path);
    process.stdout.write(
      `nuhuh gate installed at ${path}\n` +
        `from now on, "Done" only counts when the receipt is green.\n` +
        `remove it with nuhuh uninit${hasFlag(args, '--global') ? ' --global' : ''}, pause it with NUHUH_OFF=1\n`,
    );
    return 0;
  }

  if (command === 'uninit') {
    uninstallHook(settingsPath(hasFlag(args, '--global')));
    process.stdout.write('nuhuh gate removed.\n');
    return 0;
  }

  if (command !== undefined) {
    process.stderr.write(`nuhuh: unknown command "${command}"\n\n${HELP}`);
    return 2;
  }

  const result = await postHoc({ cwd: process.cwd(), color });
  if (json) {
    process.stdout.write(JSON.stringify({ exitCode: result.exitCode, verdicts: result.verdicts }, null, 2) + '\n');
  } else {
    process.stdout.write(result.receipt + '\n');
  }
  return result.exitCode;
}

main().then(
  (code) => process.exit(code),
  (err) => {
    process.stderr.write(`nuhuh: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(2);
  },
);
