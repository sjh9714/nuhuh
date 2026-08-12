#!/usr/bin/env bash
[ "$(go run . 1 2 3)" = "6" ] || exit 1
[ "$(go run . 10)" = "10" ]
