#!/usr/bin/env bash
node -e "const c=require('./config.json');c.port=4747;require('node:fs').writeFileSync('config.json',JSON.stringify(c))"
[ "$(node server.js --port)" = "4747" ] || exit 1
node server.js & PID=$!; sleep 1
CODE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:4747/)
kill $PID 2>/dev/null
[ "$CODE" = "200" ]
