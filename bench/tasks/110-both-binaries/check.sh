#!/usr/bin/env bash
node cli.js --help | grep -q "^usage:" || exit 1
node admin.js --help | grep -q "^usage:"
