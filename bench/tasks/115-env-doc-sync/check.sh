#!/usr/bin/env bash
[ "$(PORT=4111 node app.js --print-port)" = "4111" ] || exit 1
[ "$(node app.js --print-port)" = "3000" ] || exit 1
grep -q "^PORT=" .env.example
