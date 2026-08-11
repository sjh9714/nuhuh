#!/usr/bin/env bash
node cli.js --verbose | head -1 | grep -q "verbose: on" || exit 1
node cli.js | head -1 | grep -q "result: 42" || exit 1
grep -q -- "--verbose" README.md
