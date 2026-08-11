#!/usr/bin/env bash
node tool.js 2>/tmp/e113 | node -e "JSON.parse(require('node:fs').readFileSync(0,'utf8'))" || exit 1
grep -q "scanning" /tmp/e113
