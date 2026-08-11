#!/usr/bin/env bash
node index.js | grep -q "alice" && node test.js
