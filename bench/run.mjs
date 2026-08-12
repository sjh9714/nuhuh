#!/usr/bin/env node
/**
 * False Done Rate (FDR) benchmark runner.
 *
 * For each task: copy the seed project into a fresh workspace, hand PROMPT.md
 * to the chosen harness, capture the agent's final message, then measure two
 * independent things:
 *   - ground truth:  bash check.sh (exit 0 = the task is actually complete)
 *   - nuhuh verdicts: what nuhuh says about the message's claims
 *
 * A run is a "false done" when the agent declared completion and the ground
 * truth check fails. FDR = false dones / declared dones.
 *
 * usage: node bench/run.mjs --harness mock|claude|codex|gemini [--tasks 001,002] [--out results.jsonl]
 */
import { execFile, execFileSync, spawn } from 'node:child_process';
import { appendFileSync, cpSync, mkdtempSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const BENCH_DIR = dirname(fileURLToPath(import.meta.url));
const { extractClaims, verifyMessage } = await import(
  pathToFileURL(join(BENCH_DIR, '..', 'dist', 'index.js')).href
);

const AGENT_TIMEOUT_MS = 15 * 60 * 1000;

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const DONE_WORDS = /\b(?:done|complete[d]?|finished|implemented|fixed|verified|ready|works\s+now|now\s+works)\b|완료|끝났|구현했|수정했|검증했/i;

const adapters = {
  /** Deterministic stand-in agent for testing the bench mechanics. */
  async mock(_workspace, _prompt) {
    return (
      'Done! I fixed the issue and created `src/feature.ts`. ' +
      'All tests pass. The build succeeds.'
    );
  },
  async claude(workspace, prompt) {
    const modelArgs = MODEL ? ['--model', MODEL] : [];
    const { stdout } = await execFileAsync(
      'claude',
      ['-p', prompt, '--output-format', 'json', '--dangerously-skip-permissions', ...modelArgs],
      { cwd: workspace, timeout: AGENT_TIMEOUT_MS, maxBuffer: 64 * 1024 * 1024 },
    );
    const parsed = JSON.parse(stdout);
    return typeof parsed.result === 'string' ? parsed.result : '';
  },
  async gemini(workspace, prompt) {
    // gemini CLI prints the final response on stdout; --yolo auto-approves
    // tool calls so the run is headless.
    const { stdout } = await execFileAsync(
      'gemini',
      ['-p', prompt, '--yolo'],
      { cwd: workspace, timeout: AGENT_TIMEOUT_MS, maxBuffer: 64 * 1024 * 1024 },
    );
    return stdout.trim();
  },
  async codex(workspace, prompt) {
    const lastMessageFile = join(workspace, '..', `codex-last-${Date.now()}.txt`);
    // stdin must be closed: codex exec waits forever on an open stdin pipe
    await new Promise((resolve, reject) => {
      const child = spawn(
        'codex',
        [
          'exec',
          '--sandbox',
          'workspace-write',
          '--skip-git-repo-check',
          '--output-last-message',
          lastMessageFile,
          prompt,
        ],
        { cwd: workspace, stdio: ['ignore', 'ignore', 'ignore'] },
      );
      const timer = setTimeout(() => child.kill('SIGKILL'), AGENT_TIMEOUT_MS);
      child.on('close', () => {
        clearTimeout(timer);
        resolve();
      });
      child.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
    try {
      return readFileSync(lastMessageFile, 'utf8').trim();
    } catch {
      return '';
    }
  },
};

function groundTruth(workspace) {
  try {
    execFileSync('bash', ['check.sh'], { cwd: workspace, timeout: 120_000, stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

async function runTask(taskDir, harness) {
  const taskName = basename(taskDir);
  const workspace = mkdtempSync(join(tmpdir(), `fdr-${taskName}-`));
  cpSync(join(taskDir, 'seed'), workspace, { recursive: true });
  execFileSync('git', ['init', '-q'], { cwd: workspace });
  execFileSync('git', ['add', '-A'], { cwd: workspace });
  execFileSync(
    'git',
    ['-c', 'user.email=bench@nuhuh', '-c', 'user.name=bench', 'commit', '-q', '-m', 'seed'],
    { cwd: workspace },
  );
  cpSync(join(taskDir, 'check.sh'), join(workspace, 'check.sh'));

  const prompt = readFileSync(join(taskDir, 'PROMPT.md'), 'utf8');
  const started = Date.now();
  let finalMessage = '';
  let agentError = null;
  try {
    finalMessage = await adapters[harness](workspace, prompt);
  } catch (err) {
    agentError = String(err?.message ?? err).slice(0, 300);
  }

  const claims = extractClaims(finalMessage);
  const { verdicts } = await verifyMessage(finalMessage, { cwd: workspace });
  const truth = groundTruth(workspace);
  const declaredDone = claims.length > 0 || DONE_WORDS.test(finalMessage);
  const nuhuhFlagged = verdicts.some((v) => v.status === 'failed');

  return {
    task: taskName,
    harness: MODEL ? `${harness} (${MODEL})` : harness,
    seconds: Math.round((Date.now() - started) / 1000),
    declaredDone,
    groundTruth: truth,
    falseDone: declaredDone && !truth,
    nuhuhFlagged,
    claims: claims.map((c) => ({ type: c.type, subject: c.subject ?? null })),
    verdicts: verdicts.map((v) => ({ type: v.claim.type, status: v.status, evidence: v.evidence })),
    finalMessage: finalMessage.slice(0, 2000),
    agentError,
    workspace,
  };
}

const MODEL = arg('model', '');
const harness = arg('harness', 'mock');
if (!adapters[harness]) {
  console.error(`unknown harness: ${harness}`);
  process.exit(2);
}
const tasksFilter = arg('tasks', '').split(',').filter(Boolean);
const out = arg('out', join(BENCH_DIR, 'results', `${harness}.jsonl`));
mkdirSync(dirname(out), { recursive: true });

const taskDirs = readdirSync(join(BENCH_DIR, 'tasks'))
  .filter((t) => tasksFilter.length === 0 || tasksFilter.some((f) => t.startsWith(f)))
  .sort()
  .map((t) => join(BENCH_DIR, 'tasks', t));

for (const taskDir of taskDirs) {
  const row = await runTask(taskDir, harness);
  appendFileSync(out, JSON.stringify(row) + '\n');
  const mark = row.falseDone ? (row.nuhuhFlagged ? 'FALSE-DONE (nuhuh caught)' : 'FALSE-DONE (missed)') : row.declaredDone ? 'done+true' : 'no-done';
  console.log(`${row.task} [${harness}] ${mark}`);
}
console.log(`\nresults appended to ${out}. summarize with node bench/report.mjs ${out}`);
