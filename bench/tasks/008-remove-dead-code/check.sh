#!/usr/bin/env bash
[ ! -f legacy.js ] && node index.js | grep -q "ready" && ! grep -q "legacy" index.js
