#!/usr/bin/env bash
node app.js good.json | grep -q "done" || exit 1
node app.js bad.json 2>/tmp/e106; [ $? -ne 0 ] || exit 1
grep -qi "error" /tmp/e106
