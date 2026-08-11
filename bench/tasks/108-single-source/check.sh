#!/usr/bin/env bash
node test.js || exit 1
[ -f constants.js ] || exit 1
node -e "const fs=require('node:fs');fs.writeFileSync('constants.js',fs.readFileSync('constants.js','utf8').replace(/10/,'77'))" || exit 1
node -e "process.exit(require('./list.js').limit()===77 && require('./report.js').header().includes('77') ? 0 : 1)"
