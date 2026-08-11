#!/usr/bin/env bash
[ "$(node format.js 187)" = "03:07" ] || exit 1
[ "$(node format.js 3671)" = "61:11" ]
