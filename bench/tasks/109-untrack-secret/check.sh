#!/usr/bin/env bash
grep -rq "VERYSECRET123" config.js app.js && exit 1
TOKEN=abc node app.js | grep -q "token loaded" || exit 1
grep -q "^\.env$" .gitignore
