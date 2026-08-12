import type { Claim } from '../types.js';
import {
  BUILD_PASS,
  ENDPOINT_WORKS_VERBS,
  ENV_CONTEXT,
  ENV_KEY,
  ENV_SET_VERBS,
  FILE_CREATED_ADJACENT,
  GIT_COMMITTED,
  FILE_REMOVED_ADJACENT,
  LINT_PASS,
  TESTS_PASS,
  normalizePathToken,
  type SentencePattern,
} from './patterns.js';

const URL_IN_SENTENCE = /https?:\/\/[^\s`'"()]+/;

function splitSentences(message: string): string[] {
  return message
    .split(/(?<=[.!?。！？])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function matches(sentence: string, pattern: SentencePattern): boolean {
  return pattern.match.some((p) => p.test(sentence)) && !pattern.negate.some((p) => p.test(sentence));
}

/** Paths captured by verb-adjacent patterns, filtered to path-shaped tokens. */
function adjacentPaths(sentence: string, patterns: RegExp[]): string[] {
  const paths: string[] = [];
  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    for (const m of sentence.matchAll(pattern)) {
      const path = normalizePathToken(m[1] ?? '');
      if (path && !paths.includes(path)) paths.push(path);
    }
  }
  return paths;
}

export function extractClaims(message: string): Claim[] {
  const claims: Claim[] = [];
  for (const sentence of splitSentences(message)) {
    if (matches(sentence, TESTS_PASS)) {
      claims.push({ type: 'tests-pass', quote: sentence });
    }
    if (matches(sentence, BUILD_PASS)) {
      claims.push({ type: 'build-pass', quote: sentence });
    }
    if (matches(sentence, LINT_PASS)) {
      claims.push({ type: 'lint-pass', quote: sentence });
    }
    if (matches(sentence, GIT_COMMITTED)) {
      claims.push({ type: 'git-committed', quote: sentence });
    }
    const removedPaths = adjacentPaths(sentence, FILE_REMOVED_ADJACENT);
    for (const path of removedPaths) {
      claims.push({ type: 'negative-existence', quote: sentence, subject: path });
    }
    for (const path of adjacentPaths(sentence, FILE_CREATED_ADJACENT)) {
      // A path can't be both created and removed by one sentence; removal wins
      // ("moved" phrasings) and file-created stays silent rather than accuse.
      if (!removedPaths.includes(path)) {
        claims.push({ type: 'file-created', quote: sentence, subject: path });
      }
    }

    const url = sentence.match(URL_IN_SENTENCE);
    if (url && ENDPOINT_WORKS_VERBS.some((p) => p.test(sentence))) {
      claims.push({
        type: 'endpoint-works',
        quote: sentence,
        subject: url[0].replace(/[.,;:!?]+$/, ''),
      });
    }

    if (ENV_CONTEXT.test(sentence) && ENV_SET_VERBS.some((p) => p.test(sentence))) {
      const key = sentence.match(ENV_KEY);
      if (key?.[1]) {
        claims.push({ type: 'env-set', quote: sentence, subject: key[1] });
      }
    }
  }
  return claims;
}
