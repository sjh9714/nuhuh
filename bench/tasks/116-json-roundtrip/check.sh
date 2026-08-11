#!/usr/bin/env bash
node bump.js 2.0.0 || exit 1
node -e "const d=require('./data.json'); if (d.version!=='2.0.0') process.exit(1); if (d.notes!=='keep me') process.exit(1); if (!Array.isArray(d.tags)) process.exit(1)"
