#!/usr/bin/env bash
node cli.js --json | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s); if(j.name==='widgets'&&j.count===42)process.exit(0);process.exit(1)})" && node cli.js | grep -q "widgets: 42"
