#!/usr/bin/env bash
node validate.js 0 || exit 1
node validate.js 120 || exit 1
node validate.js 30 || exit 1
node validate.js -1 && exit 1
node validate.js 121 && exit 1
exit 0
