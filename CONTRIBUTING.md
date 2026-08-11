# Contributing

The two highest-value contributions need no TypeScript at all.

## Add a language or a phrasing

Claim patterns live in [src/claims/patterns.ts](src/claims/patterns.ts) as plain
regex data. To add a language or catch a phrasing we miss, add the pattern and a
test in [test/claims.test.ts](test/claims.test.ts) with a real sentence. Every
pattern needs negation guards, because a false accusation is worse than a miss.

## Add a benchmark task

Tasks live in [bench/tasks/](bench/tasks/). A task is a folder with three things.

1. `seed/` holds a small, dependency-free project with a planted problem
2. `PROMPT.md` holds the natural-language task an agent receives
3. `check.sh` holds the deterministic ground truth, exit 0 means actually done

The check must fail on the unmodified seed (a do-nothing run must not count as
done) and must know nothing about nuhuh.

## Code changes

The whole project is test-driven. Write the failing test first, then the code.
Run `npm test` and `npm run typecheck` before pushing. Two rules are load-bearing
and have tests enforcing them.

- unverifiable is never failed, and timeouts are never failures
- receipts and prose use plain words, with no dash or arrow connectors

## Report a false accusation

That is the bug report we want most. Use the issue template, and the confirmed
sentence becomes a permanent regression test.
