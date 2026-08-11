import { readFileSync, statSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import type { Claim, Verdict, VerifyContext } from '../types.js';
import { censusFindings } from './census.js';
import { runCommand } from './run.js';
import { detectCommand, type ScriptKind } from './runners.js';

async function verifyScript(
  claim: Claim,
  ctx: VerifyContext,
  scriptName: ScriptKind,
): Promise<Verdict> {
  const detected = detectCommand(ctx.cwd, scriptName);
  if (!detected) {
    return {
      claim,
      status: 'unverifiable',
      evidence: `no runnable ${scriptName} command found in this project's manifests`,
    };
  }
  const { command } = detected;
  const result = await runCommand(command, ctx.cwd, ctx.timeoutMs);
  if (result.timedOut) {
    // A timeout proves nothing either way. Accusing here is how tools lose trust.
    return {
      claim,
      status: 'unverifiable',
      evidence: `ran \`${command}\` and it timed out before finishing`,
      command,
      outputHash: result.outputHash,
    };
  }
  if (result.exitCode === null) {
    return {
      claim,
      status: 'unverifiable',
      evidence: `could not start \`${command}\``,
      command,
    };
  }
  const summary = result.summaryLine.length > 0 ? ` ("${result.summaryLine}")` : '';
  // A green suite means less when the session shrank it. These are notes, not
  // verdicts. Skipping can be legitimate, so the receipt shows it and does not accuse.
  const census = scriptName === 'test' && result.exitCode === 0 ? censusFindings(ctx.cwd) : [];
  const censusNote = census.length > 0 ? ` (${census.join(', and ')})` : '';
  return {
    claim,
    status: result.exitCode === 0 ? 'verified' : 'failed',
    evidence: `ran \`${command}\` fresh, exit ${result.exitCode}${summary}${censusNote}`,
    command,
    exitCode: result.exitCode,
    outputHash: result.outputHash,
  };
}

function verifyFileCreated(claim: Claim, ctx: VerifyContext): Verdict {
  if (!claim.subject) {
    return { claim, status: 'unverifiable', evidence: 'no file path named in the claim' };
  }
  const root = resolve(ctx.cwd);
  const target = resolve(root, claim.subject);
  if (target !== root && !target.startsWith(root + sep)) {
    return {
      claim,
      status: 'unverifiable',
      evidence: `path ${claim.subject} is outside the project, and nuhuh only checks inside it`,
    };
  }
  try {
    const stat = statSync(target);
    return {
      claim,
      status: 'verified',
      evidence: `${claim.subject} exists (${stat.size} bytes)`,
    };
  } catch {
    return {
      claim,
      status: 'failed',
      evidence: `${claim.subject} does not exist`,
    };
  }
}

const ENV_FILES = [
  '.env',
  '.env.local',
  '.env.development',
  '.env.production',
  '.env.test',
  // Documentation files count: "documented API_KEY in .env.example" is a real
  // claim agents make, and accusing it was a live false accusation.
  '.env.example',
  '.env.sample',
  '.env.template',
];

function verifyEnvSet(claim: Claim, ctx: VerifyContext): Verdict {
  if (!claim.subject) {
    return { claim, status: 'unverifiable', evidence: 'no env key named in the claim' };
  }
  const keyLine = new RegExp(`^\\s*(?:export\\s+)?${claim.subject}\\s*=`, 'm');
  const seen: string[] = [];
  for (const file of ENV_FILES) {
    let content: string;
    try {
      content = readFileSync(join(ctx.cwd, file), 'utf8');
    } catch {
      continue;
    }
    seen.push(file);
    if (keyLine.test(content)) {
      // Presence only. The value never enters the receipt.
      return { claim, status: 'verified', evidence: `${claim.subject} is set in ${file}` };
    }
  }
  return {
    claim,
    status: 'failed',
    evidence:
      seen.length > 0
        ? `${claim.subject} is not set in ${seen.join(', ')}`
        : `no .env file exists, so ${claim.subject} is not set anywhere`,
  };
}

function verifyNegativeExistence(claim: Claim, ctx: VerifyContext): Verdict {
  if (!claim.subject) {
    return { claim, status: 'unverifiable', evidence: 'no path named in the claim' };
  }
  const root = resolve(ctx.cwd);
  const target = resolve(root, claim.subject);
  if (target !== root && !target.startsWith(root + sep)) {
    return {
      claim,
      status: 'unverifiable',
      evidence: `path ${claim.subject} is outside the project, and nuhuh only checks inside it`,
    };
  }
  try {
    statSync(target);
    return { claim, status: 'failed', evidence: `${claim.subject} still exists` };
  } catch {
    return { claim, status: 'verified', evidence: `${claim.subject} is gone, as claimed` };
  }
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '[::1]']);

async function verifyEndpoint(claim: Claim, ctx: VerifyContext): Promise<Verdict> {
  if (!claim.subject) {
    return { claim, status: 'unverifiable', evidence: 'no URL named in the claim' };
  }
  let url: URL;
  try {
    url = new URL(claim.subject);
  } catch {
    return { claim, status: 'unverifiable', evidence: `cannot parse URL ${claim.subject}` };
  }
  if (!LOCAL_HOSTS.has(url.hostname) && !LOCAL_HOSTS.has(`[${url.hostname}]`)) {
    return {
      claim,
      status: 'unverifiable',
      evidence: `only local endpoints are probed, and ${url.hostname} is not local`,
    };
  }
  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'manual',
      signal: AbortSignal.timeout(Math.min(ctx.timeoutMs ?? 10_000, 10_000)),
    });
    const ok = response.status < 400;
    return {
      claim,
      status: ok ? 'verified' : 'failed',
      evidence: `GET ${url.pathname || '/'} answered ${response.status}`,
    };
  } catch {
    return {
      claim,
      status: 'unverifiable',
      evidence: `nothing answered at ${url.host}. the server may simply not be running, so this proves nothing either way`,
    };
  }
}

export async function verifyClaim(claim: Claim, ctx: VerifyContext): Promise<Verdict> {
  switch (claim.type) {
    case 'file-created':
      return verifyFileCreated(claim, ctx);
    case 'tests-pass':
      return verifyScript(claim, ctx, 'test');
    case 'build-pass':
      return verifyScript(claim, ctx, 'build');
    case 'lint-pass':
      return verifyScript(claim, ctx, 'lint');
    case 'endpoint-works':
      return verifyEndpoint(claim, ctx);
    case 'env-set':
      return verifyEnvSet(claim, ctx);
    case 'negative-existence':
      return verifyNegativeExistence(claim, ctx);
  }
}
