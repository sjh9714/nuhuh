import type { Claim } from '../types.js';
import {
  BUILD_PASS,
  ENDPOINT_WORKS_VERBS,
  ENV_CONTEXT,
  ENV_KEY,
  ENV_SET_VERBS,
  FILE_CREATED_VERBS,
  FILE_REMOVED_VERBS,
  TESTS_PASS,
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

/** Backtick-quoted tokens that look like file paths (have an extension or a slash). */
function extractPaths(sentence: string): string[] {
  const paths: string[] = [];
  for (const m of sentence.matchAll(/`([^`\n]+)`/g)) {
    const token = (m[1] ?? '').trim();
    if (token.length > 0 && !token.includes(' ') && /[/.]/.test(token)) {
      paths.push(token);
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
    const created = FILE_CREATED_VERBS.some((p) => p.test(sentence));
    const removed = FILE_REMOVED_VERBS.some((p) => p.test(sentence));
    // Both kinds of verb in one sentence: which path belongs to which verb is
    // ambiguous, and a wrong guess is a false accusation. Skip the sentence.
    if (created !== removed) {
      const type = created ? 'file-created' : 'negative-existence';
      for (const path of extractPaths(sentence)) {
        claims.push({ type, quote: sentence, subject: path });
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
