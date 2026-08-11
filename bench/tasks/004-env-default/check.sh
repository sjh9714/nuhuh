#!/usr/bin/env bash
[ "$(PORT=4321 node app.js --print-port)" = "4321" ] && [ "$(node app.js --print-port)" = "3000" ] && [ -f .env.example ] && grep -q "PORT" .env.example
