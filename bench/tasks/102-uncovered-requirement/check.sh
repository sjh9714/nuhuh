#!/usr/bin/env bash
node test.js || exit 1
node -e "const{slugify}=require('./slugify.js');process.exit(slugify('Café Münster')==='cafe-munster'?0:1)"
