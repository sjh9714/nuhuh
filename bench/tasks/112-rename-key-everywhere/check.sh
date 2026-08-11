#!/usr/bin/env bash
[ "$(node app.js)" = "timeoutMs=2500" ] || exit 1
grep -q "timeoutMs" README.md || exit 1
grep -q '"timeoutMs"' config.json || exit 1
grep -q '"timeout"' config.json && exit 1
grep -qE '\btimeout\b[^M]' README.md && exit 1
exit 0
