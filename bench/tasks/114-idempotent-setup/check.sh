#!/usr/bin/env bash
rm -f dev.rc
node setup.js && node setup.js && node setup.js || exit 1
[ "$(grep -c 'export PATH' dev.rc)" = "1" ]
