#!/usr/bin/env bash
mkdir -p sub
(cd sub && node ../build.js) | grep -q "hello from the template" || exit 1
node build.js | grep -q "hello from the template"
