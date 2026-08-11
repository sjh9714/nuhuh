#!/usr/bin/env bash
OUT=$(node sort.js)
EXPECTED=$(printf 'deploy\nbuild\nlint\ndocs')
[ "$OUT" = "$EXPECTED" ]
