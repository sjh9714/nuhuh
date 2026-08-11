#!/usr/bin/env bash
node server.js >/tmp/o117 2>&1 &
PID=$!
sleep 1
kill -TERM $PID
WAITED=0
while kill -0 $PID 2>/dev/null; do
  sleep 0.2
  WAITED=$((WAITED + 1))
  [ $WAITED -gt 10 ] && kill -9 $PID && exit 1
done
wait $PID
[ $? -eq 0 ] || exit 1
grep -q "bye" /tmp/o117
