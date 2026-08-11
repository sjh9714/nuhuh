`node setup.js` appends the PATH line to `dev.rc`. Running it twice currently duplicates the line. Make setup idempotent so the line appears exactly once no matter how many times it runs.
