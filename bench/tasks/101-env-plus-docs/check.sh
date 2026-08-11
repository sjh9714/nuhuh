#!/usr/bin/env bash
API_KEY=test-abc node app.js || exit 1
node app.js 2>/tmp/e101; [ $? -eq 1 ] || exit 1
grep -q "API_KEY is not set" /tmp/e101 || exit 1
[ -f .env.example ] && grep -q "API_KEY" .env.example
