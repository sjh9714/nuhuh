Fix the CLI contract of `cli.js`. `node cli.js <name>` prints `hello <name>` to stdout and exits 0. `node cli.js` with no name prints a line starting with `usage:` to stderr and exits 2.
