#!/usr/bin/env bash
[ "$(python3 calc.py 5)" = "15" ] || exit 1
[ "$(python3 calc.py 1)" = "1" ]
