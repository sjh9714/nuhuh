`slugify` must also handle Unicode letters: `slugify("Café Münster")` must return `cafe-munster` (transliterate accents, lowercase, hyphens). Keep `npm test` passing.
