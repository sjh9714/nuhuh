# The False Done Rate (FDR) benchmark

The question measured is simple. When a coding agent says "Done", how often is
that false, and how many of those false dones does nuhuh catch?

## Definitions

- **declared done** means the agent's final message contains at least one
  completion claim (extracted by nuhuh's deterministic patterns) or an explicit
  done-word.
- **ground truth** means `check.sh` for the task exits 0 in the agent's
  workspace. Every check is deterministic and knows nothing about nuhuh.
- **false done** means declared done while the ground truth check failed.
- **FDR** is false dones divided by declared dones.
- **caught by nuhuh** counts, among false dones, the runs where nuhuh's fresh
  verification marked at least one claim `failed`.

Ground truth and nuhuh are measured independently, so the benchmark can expose
nuhuh's own misses. Publishing that number too is the point. The first live run
did exactly that and surfaced four false accusations in nuhuh, each now a
permanent regression test.

## Tasks

Each task under `tasks/` is a small, dependency-free Node project with a planted
problem, a natural-language `PROMPT.md`, and a `check.sh` ground truth. The
`001` series is single-file work. The `101` series is multi-requirement work
designed to invite misses outside the diff, like env plus docs, uncovered
requirements, second binaries, exit-code contracts, stdout purity, idempotence
and graceful shutdown. The `201` series is polyglot, Python scripts, pytest
suites and Go modules, so the numbers stop being a Node-only claim. Seeds are committed to git in the workspace before the
agent starts, so test-census (newly skipped tests) is measurable. Every check
is verified in both directions before it counts, red on the unmodified seed so
a do-nothing run cannot score as done, and green on a reference fix so an
impossible check cannot inflate the numbers.

## Running

```bash
npm run build
node bench/run.mjs --harness mock            # mechanics smoke-run against an agent that always lies
node bench/run.mjs --harness claude          # requires the claude CLI, runs with --dangerously-skip-permissions in a throwaway workspace
node bench/run.mjs --harness codex           # requires the codex CLI
node bench/run.mjs --harness gemini          # requires the gemini CLI with --yolo auth working
node bench/report.mjs bench/results/*.jsonl  # markdown summary table
```

A warning. Live-harness runs consume real tokens and take minutes per task.

## Measured so far

Three rounds of all 34 tasks per harness, 102 runs each, 2026-08-11 and 08-12.

| harness | runs | declared done | false dones | FDR |
| --- | --- | --- | --- | --- |
| claude, frontier default | 102 | 98 | 0 | 0.0% |
| codex, default | 102 | 97 | 2 | 2.1% |
| claude, haiku-4-5 | 102 | 84 | 5 | 6.0% |

The polyglot `201` series (Python and Go) produced zero false dones in 36
runs across all three harnesses, so the false-done generators remain the
multi-place consistency chores, not the language.

Single runs lie, and our own data keeps proving it. Codex measured 0% on its
first round and 4.1% over the first three. Haiku measured 12.5% on its first
round and 6.8% over ninety runs. Trust the multi-round numbers, and treat
anything below that as noise.

The false-done generators are tasks 104 and 112, both consistency chores
where the fix has to land in several places at once. The models declare
victory with a hardcoded port still in place, or with the old config key
still alive in one of the three files, and in every single false done the
declaration carried no claim nuhuh can check. One haiku run even printed its
own green checkmark per file, all three wrong. A second class came from task
107, where the small model wrote a lint script whose failures BSD find
silently swallows on macOS, then truthfully reported that its broken check
passes. nuhuh verifies claims, not specs, so a true claim about a defective
check gets past it, and a victory lap with no checkable claim gives it
nothing to grab. Ground truth is the only thing that catches those classes,
which is why this benchmark exists and why its checks know nothing about
nuhuh.

## What strict mode would have done

`NUHUH_STRICT=1` bounces a completion declaration that carries zero checkable
claims. Replayed offline against every final message above, strict mode
catches **7 of 7** false dones, every one was a claim-free victory lap. The
honest other half: it would also have challenged 58% of haiku's true dones,
70% of frontier Claude's and 90% of codex's, because short task reports
often carry no checkable claim either. Each challenge costs one bounce in
which the agent restates its result in checkable terms. That price is why
strict mode is opt-in, and why it fits unattended lanes (CI, batch, cheap
workers) better than interactive sessions.

## Honest limitations

- 30 tasks, 3 rounds each. Enough to publish, still small. More tasks and
  more rounds keep being the cheapest way to make the numbers harder.
- The tasks are small Node projects. FDR on large real-world repos is an open
  question this benchmark does not answer yet.
- Ground-truth checks probe observable behavior, not code quality.
