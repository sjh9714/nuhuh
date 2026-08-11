Make the API key configurable end to end:
1. `app.js` must read `API_KEY` from the environment.
2. When `API_KEY` is missing, the app must print `error: API_KEY is not set` to stderr and exit with code 1.
3. Document the variable in a `.env.example` file.
