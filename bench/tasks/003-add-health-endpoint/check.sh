#!/usr/bin/env bash
PORT=4310 node server.js &
PID=$!
sleep 1
BODY=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:4310/health)
HOME_OK=$(curl -s http://127.0.0.1:4310/)
kill $PID 2>/dev/null
[ "$BODY" = "200" ] && [ "$HOME_OK" = "home" ]
