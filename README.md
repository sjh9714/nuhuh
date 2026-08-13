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
  <sub><a href="README.ko.md">한국어</a> · <a href="README.zh-CN.md">简体中文</a> · <a href="README.ja.md">日本語</a></sub>
</p>

<p align="center">
  <img src="docs/demo.gif" width="880" alt="nuhuh demo. the agent declares Done, nuhuh re-runs every claim fresh, rejects the false Done with a red receipt, and accepts once the fix turns the receipt green">
</p>

Coding agents end almost every task the same way. **"Done! All tests pass."**
Sometimes that is true. Researchers who checked found that among failing agent
runs which graded themselves, [**75.8% asserted success anyway**](https://arxiv.org/abs/2606.09863).
And the misses are rarely in the diff. They live in the test that never ran,
the env var that never got set, the endpoint that answers 500.

nuhuh does not read the diff and does not ask a model for its opinion. It takes
each claim in the agent's final message and **re-runs reality, fresh**. The
whole test suite in a clean process. The build. The file on disk. The local
endpoint. Then it prints a receipt that nuhuh wrote, not one the agent dictated.

```
🧾 receipt

✅ src/login.ts
   src/login.ts exists (33 bytes)
❌ src/login.test.ts
   src/login.test.ts does not exist
❌ All tests pass.
   ran `npm test` fresh, exit 1 ("Tests: 1 failed, 3 passed")
✅ The build succeeds.
   ran `npm run build` fresh, exit 0

2 of 4 claims verified, 2 failed.
```

## Try it in 10 seconds

```bash
npx nuhuh demo    # watch it catch a staged false "Done", with no setup and nothing touched
npx nuhuh         # check the real last "Done" of YOUR latest session, in any project
```

nuhuh reads the Claude Code session logs already on your disk, with Codex
rollouts as fallback. It extracts the completion claims from the last message
and verifies each one against your working tree. MIT licensed, no account,
no API key, **no model call**. Nothing leaves your machine.

## Gate mode, where "Done" stops being a feeling

```bash
npx nuhuh init
```

That installs a Stop hook. From then on, every time the agent tries to finish,

1. nuhuh extracts the claims from its final message
2. runs the experiments (fresh test run, build, files, endpoints, env)
3. **rejects the "Done" if a claim is false**, and feeds the failing evidence
   straight back to the agent, which goes back to work
4. after 3 bounces it stops arguing and hands the receipt to you

You stop being the person who re-runs the tests after the agent swears it did.
`nuhuh log` shows what the gate actually did, one line per decision.
`nuhuh uninit` removes it, and `NUHUH_OFF=1` pauses it for a session.
By default a green receipt stays silent. Set `NUHUH_RECEIPT=always` and the
gate prints the success receipt into the session too, so the agent never
learns that a confident sentence is enough on its own.
`NUHUH_STRICT=1` goes one step further and bounces a completion declaration
that carries no checkable claim at all, asking for evidence instead. That
claim-free "Done!" is the single most common false completion we measured.

## The more you delegate, the more you need this

Our own benchmark says the frontier model rarely lies about Done, 0.0% over
102 runs. The false Dones came from the smaller, cheaper models, 6.0% for
Haiku 4.5, 2.1% for Codex. Which is exactly where agent workflows are
heading: one strong orchestrator delegating to cheap workers, batch runs,
CI pipelines nobody watches. The gate is the safety belt for the delegated
lane. Verify the cheap work mechanically, spend the expensive model on
judgment.

## What it checks

| the agent says | nuhuh does |
| --- | --- |
| "all tests pass" | runs the **entire** suite fresh in a clean process and reads the exit code, not the prose. Also notes when the session added `.skip`, `.only` or `xit`, because a test that no longer runs cannot fail |
| "the build succeeds" | runs the build script, and the exit code decides |
| "I created `src/x.ts`" | checks the file is really there |
| "I deleted `legacy.js`" or "there is no X" | checks it is really gone |
| "the endpoint at localhost:3000 works" | actually calls it (local hosts only, ever) |
| "I set `DATABASE_URL` in .env" | checks the key exists, and the value never enters the receipt |
| "I committed the changes" | reads git, fails the claim when tracked files still have uncommitted changes |

Claims are matched in English, Korean, Japanese and Simplified Chinese. The patterns are
[a data file](src/claims/patterns.ts), so adding a language is a PR, not a fork.

## Why not just have another model review it

The popular answer is a second LLM as an adversarial reviewer. It has three
problems that a test runner does not.

| | second LLM as reviewer | nuhuh |
| --- | --- | --- |
| tokens per check | a full review, every bounce | zero |
| verdict | opinion, [AUROC 0.54 to 0.65](https://arxiv.org/abs/2606.09863) on this failure class | exit codes, deterministic |
| knows when to stop | no, it can find new flaws 25 rounds in a row | yes, claims either verify or they don't, and repeated identical failures end the loop |

The judges fail because they "rely on surface completion proxies like
confident closing language rather than verified state changes." A test runner
detects a failing suite at 1.0. nuhuh is a test runner wearing a Stop hook.

The diff-reading alternative has the opposite blind spot. A reviewer that
reads the diff as ground truth cannot see the miss that lives outside the
diff, like the unset env var, the never-run migration, the server that is not
listening. Those are exactly the claims nuhuh probes.

## The False Done Rate benchmark

`bench/` contains a growing, reproducible benchmark that measures, per
harness, how often "Done" is false, **and how many of those nuhuh catches or
misses**. Ground truth is a set of deterministic `check.sh` scripts that know
nothing about nuhuh, so the benchmark can expose nuhuh's own blind spots.

It already has. The first live run caught nuhuh making four false accusations
(a line reference read as a path, code identifiers read as paths, a wrong
deletion attribution, and a key documented in `.env.example`). Each one is now
a permanent regression test. Methodology and honest limitations live in
[bench/README.md](bench/README.md).

## What it does not do

- It cannot tell you the code is *good*. It tells you whether what the agent
  **said** is what your machine **does**, which is a smaller, checkable claim.
- A claim nuhuh has no safe way to check is marked `⚠️ unverifiable`, never
  `failed`. Timeouts prove nothing and are never treated as failures. The tool
  is tuned to miss rather than to accuse, because a false accusation costs your
  trust and a miss costs one check.
- It only ever probes localhost, only reads inside your project, and only runs
  commands defined in your project's own manifests, never commands taken from
  the agent's text.

## Related work

Verifying agents is not a new wish. The mechanism is the difference.

- [taskmaster](https://github.com/blader/taskmaster) keeps the agent working until it *says* it is done, and that done-token is trusted. nuhuh trusts nothing it can re-run.
- [tdd-guard](https://github.com/nizos/tdd-guard) and [probity](https://github.com/nizos/probity) enforce process *while editing* (test-first discipline). nuhuh checks the outcome at "Done". They compose well.
- [agent-done-or-not](https://github.com/mohamedzhioua/agent-done-or-not) records receipts for commands the agent chose to wrap. nuhuh needs no cooperation from the agent, because it extracts claims from plain language and re-executes.
- [backcheck](https://github.com/VectorInstitute/backcheck) and [agent-receipts](https://github.com/0xelitesystem/agent-receipts) audit what the *transcript* says happened. nuhuh checks what *is*, now.
- Claude Code's own `/verify` reads the diff as ground truth and explicitly does not run tests. nuhuh exists for the bugs outside the diff.

## What it runs on your machine

Worth auditing before you install anything that executes commands, so here is
the complete list.

- The only commands it ever executes are the test, build and lint scripts from
  your project's own manifests, plus git reads. Nothing from the agent's text
  is ever executed.
- The only network access is the localhost probe for an endpoint claim you can
  see in the receipt. No telemetry, no phoning home.
- The gate cannot loop forever. It respects the hook's own recursion flag,
  caps bounces at 3, and stops immediately when the same claim fails the same
  way twice. Each deny message is two lines, so bounces stay cheap in context.
- The hook `nuhuh init` writes is pinned to the exact version that installed
  it, so the gate never fetches mutable code at stop time. Moving to a newer
  nuhuh is a deliberate `nuhuh uninit` then `npx nuhuh@<version> init`.
- `nuhuh init` backs up your settings file first, and `nuhuh uninit` restores
  the hook entry cleanly whatever version it was pinned to.

## Requirements

Node 20 or newer, on macOS, Linux or Windows (all three run in CI). Claude
Code sessions are read from `~/.claude/projects` and Codex rollouts from
`~/.codex`. Fresh test and build runs use your project's own `package.json`
scripts, with pnpm, yarn and bun detected by lockfile. Beyond npm projects,
nuhuh detects Go modules (`go test ./...`, `go build ./...`, `go vet ./...`),
Cargo crates (`cargo test`, `cargo build`), pytest configuration (`pytest`)
and the project's own gradle wrapper. An explicit `package.json` script always
wins, and only standard toolchain commands ever run, never a globally
installed substitute.

## License

MIT
