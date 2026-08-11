#!/usr/bin/env bash
grep -q '"lint"' package.json || exit 1
npm run lint >/dev/null 2>&1 || exit 1
[ ! -f scripts/cleanup.js ] || node --check scripts/cleanup.js 2>/dev/null
