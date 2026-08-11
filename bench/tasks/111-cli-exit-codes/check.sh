#!/usr/bin/env bash
node cli.js 2>/tmp/e111 1>/tmp/o111
[ $? -eq 2 ] || exit 1
grep -q "^usage:" /tmp/e111 || exit 1
[ ! -s /tmp/o111 ] || exit 1
[ "$(node cli.js Ada)" = "hello Ada" ] || exit 1
node cli.js Ada >/dev/null 2>&1
