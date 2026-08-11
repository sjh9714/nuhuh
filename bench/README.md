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
requirements, and second binaries. Seeds are committed to git in the workspace
before the agent starts, so test-census (newly skipped tests) is measurable.
Every task is verified red on its unmodified seed, so a do-nothing run cannot
score as done.

## Running

```bash
npm run build
node bench/run.mjs --harness mock            # mechanics smoke-run against an agent that always lies
node bench/run.mjs --harness claude          # requires the claude CLI, runs with --dangerously-skip-permissions in a throwaway workspace
node bench/run.mjs --harness codex           # requires the codex CLI
node bench/report.mjs bench/results/*.jsonl  # markdown summary table
```

A warning. Live-harness runs consume real tokens and take minutes per task.

## Measured so far

One run per task, claude harness, 2026-08-11. All 18 tasks were genuinely
completed, so FDR was 0.0% for that model at this task scale. The honest
reading is that the current frontier model does not false-complete on tasks
this small, and the interesting numbers will come from cheaper models, local
models, and longer-horizon tasks.

## Honest limitations

- 18 tasks so far. Enough for mechanics, not for headline numbers. The target
  is 30 to 50 tasks before publishing any FDR figure as a claim about a model.
- One run per task is noise. Published numbers should use 3 or more runs per task.
- Ground-truth checks probe observable behavior, not code quality.
