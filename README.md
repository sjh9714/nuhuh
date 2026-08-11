<h1 align="center">nuhuh</h1>

<p align="center">
  <em>Your agent said "Done." nuhuh runs the experiment.</em>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/nuhuh"><img src="https://img.shields.io/npm/v/nuhuh?style=flat-square&color=111111&label=npm" alt="npm"></a>
  <a href="https://github.com/sjh9714/nuhuh/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/sjh9714/nuhuh/ci.yml?branch=main&style=flat-square&color=111111&label=ci" alt="CI"></a>
  <img src="https://img.shields.io/node/v/nuhuh?style=flat-square&color=111111" alt="Node">
  <img src="https://img.shields.io/badge/license-MIT-111111?style=flat-square" alt="MIT license">
</p>

<p align="center">
  <sub><a href="README.ko.md">한국어</a></sub>
</p>

<p align="center">
  <img src="docs/demo.gif" width="880" alt="nuhuh demo: the agent claims four things are done, nuhuh re-runs reality and catches two of them being false">
</p>

Coding agents end almost every task the same way: **"Done! All tests pass."**
Sometimes that's true. Researchers who checked found that among failing agent
runs which graded themselves, [**75.8% asserted success anyway**](https://arxiv.org/abs/2606.09863).
The misses are rarely in the diff — they're the test that never ran, the env
var never set, the endpoint that answers 500.

nuhuh doesn't read the diff and doesn't ask a model for its opinion. It takes
each claim in the agent's final message and **re-runs reality, fresh**: the
whole test suite in a clean process, the build, the file on disk, the local
endpoint. Then it prints a receipt *it* wrote — not one the agent dictated.

```
🧾 receipt

✅ src/login.ts
   src/login.ts exists (33 bytes)
❌ src/login.test.ts
   src/login.test.ts does not exist
❌ All tests pass.
   ran `npm test` fresh → exit 1 — Tests: 1 failed, 3 passed
✅ The build succeeds.
   ran `npm run build` fresh → exit 0

2 of 4 claims verified, 2 failed.
```

## Try it in 10 seconds

```bash
npx nuhuh demo    # watch it catch a staged false "Done" — no setup, nothing touched
npx nuhuh         # check the real last "Done" of YOUR latest session, in any project
```

`nuhuh` reads the Claude Code session logs already on your disk (Codex rollouts
as fallback), extracts the completion claims from the last message, and verifies
each one against your working tree. No account, no API key, **no model call** —
nothing leaves your machine.

## Gate mode: "Done" stops being a feeling

```bash
npx nuhuh init
```

That installs a Stop hook. From then on, every time the agent tries to finish:

1. nuhuh extracts the claims from its final message
2. runs the experiments (fresh test run, build, files, endpoints, env)
3. **if a claim is false, the "Done" is rejected** and the failing evidence is
   fed straight back to the agent, which goes back to work
4. after 3 bounces it stops arguing and hands the receipt to you

You stop being the person who re-runs the tests after the agent swears it did.
`nuhuh uninit` removes it; `NUHUH_OFF=1` pauses it for a session.

## What it checks

| the agent says | nuhuh does |
| --- | --- |
| "all tests pass" | runs the **entire** suite fresh in a clean process; reads the exit code, not the prose. Also notes when the session added `.skip`/`.only`/`xit` — a test that no longer runs cannot fail |
| "the build succeeds" | runs the build script; exit code decides |
| "I created `src/x.ts`" | checks the file is really there |
| "I deleted `legacy.js`" / "there is no X" | checks it's really gone |
| "the endpoint at localhost:3000 works" | actually calls it (local hosts only, ever) |
| "I set `DATABASE_URL` in .env" | checks the key exists — the value never enters the receipt |

Claims are matched in English and Korean today (the patterns are
[a data file](src/claims/patterns.ts) — adding a language is a PR, not a fork).

## Why not just ask an LLM to check?

Because it was measured, and it can't. Across 5 judge models × 5 prompt
strategies, LLM judges detected false completions at
[**AUROC 0.54–0.65**](https://arxiv.org/abs/2606.09863) — near coin-flip —
because they "rely on surface completion proxies like confident closing
language rather than verified state changes." A test runner detects a failing
suite at 1.0. nuhuh is a test runner wearing a Stop hook: **zero LLM calls in
the verification path, deterministic, same session → same receipt.**

And the diff-reading alternative has the opposite blind spot: a reviewer that
reads the diff as ground truth cannot see the miss that's *outside* the diff —
the unset env var, the never-run migration, the server that isn't listening.
Those are exactly the claims nuhuh probes.

## The False Done Rate benchmark

`bench/` contains a growing, reproducible benchmark that measures — per
harness — how often "Done" is false, **and how many of those nuhuh catches vs
misses**. Ground truth is deterministic `check.sh` scripts that know nothing
about nuhuh, so the benchmark can (and will) expose nuhuh's own blind spots.
Methodology and honest limitations: [bench/README.md](bench/README.md).

## What it does not do

- It cannot tell you the code is *good*. It tells you whether what the agent
  **said** is what your machine **does** — a smaller, checkable claim.
- A claim nuhuh has no safe way to check is marked `⚠️ unverifiable`, never
  `failed`. Timeouts prove nothing and are never treated as failures. The tool
  is tuned to miss rather than to accuse — a false accusation costs your trust,
  a miss costs one check.
- It only ever probes localhost, only reads inside your project, and only runs
  commands defined in your project's own manifests — never commands taken from
  the agent's text.

## Related work

Verifying agents is not a new wish; the mechanism is the difference.

- [taskmaster](https://github.com/blader/taskmaster) keeps the agent working until it *says* it's done — the done-token is trusted. nuhuh trusts nothing it can re-run.
- [tdd-guard](https://github.com/nizos/tdd-guard) / [probity](https://github.com/nizos/probity) enforce process *while editing* (test-first discipline). nuhuh checks the outcome at "Done". They compose well.
- [agent-done-or-not](https://github.com/mohamedzhioua/agent-done-or-not) records receipts for commands the agent chose to wrap. nuhuh needs no cooperation from the agent — it extracts claims from plain language and re-executes.
- [backcheck](https://github.com/VectorInstitute/backcheck), [agent-receipts](https://github.com/0xelitesystem/agent-receipts) audit what the *transcript* says happened. nuhuh checks what *is*, now.
- Claude Code's own `/verify` reads the diff as ground truth and explicitly does not run tests. nuhuh exists for the bugs outside the diff.

## Requirements

Node 20+. Claude Code sessions are read from `~/.claude/projects`; Codex
rollouts from `~/.codex`. Fresh test/build runs use your project's own
`package.json` scripts (pnpm/yarn/bun detected by lockfile).

## License

MIT
