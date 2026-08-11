#!/usr/bin/env bash
[ -z "$(LOG_LEVEL=silent node app.js)" ] || exit 1
node app.js | grep -q "started"
