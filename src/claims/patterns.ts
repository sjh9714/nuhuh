/**
 * Claim sentence patterns, kept as data so new languages and phrasings are
 * contributions to this file, not to the engine.
 *
 * A sentence produces a claim when it matches at least one `match` pattern
 * and none of the `negate` patterns. Tuned to miss rather than to accuse:
 * a false negative costs a check, a false positive accuses honest work.
 */

export interface SentencePattern {
  match: RegExp[];
  negate: RegExp[];
}

export const TESTS_PASS: SentencePattern = {
  match: [
    /\b(?:all\s+)?(?:\d+\s+)?tests?\s+(?:are\s+)?pass(?:es|ing|ed)?\b/i,
    /\btest\s+suite\s+(?:is\s+)?(?:pass(?:es|ing|ed)?|green)\b/i,
    /\b(?:npm|yarn|pnpm|bun)\s+(?:run\s+)?test[\w:-]*\s+pass(?:es|ed|ing)?\b/i,
    // ko: 테스트(가/는/를/도) ... 통과/성공 (bounded gap so it stays inside the clause)
    /테스트(?:가|는|를|도)?.{0,24}?(?:통과|성공)/,
  ],
  negate: [
    /\b(?:not|never|should|won't|wont|don't|dont|doesn't|doesnt|didn't|didnt|can't|cant|couldn't|couldnt|unable\s+to)\s+(?:be\s+|all\s+)?pass/i,
    // ko: any negation/failure marker in the sentence defeats the claim (miss, don't accuse)
    /않|못|실패|안\s*(?:됩|된|돼)/,
  ],
};

export const BUILD_PASS: SentencePattern = {
  match: [
    /\bbuilds?\s+(?:now\s+)?(?:succeed(?:s|ed)?|pass(?:es|ed)?|passing|compil(?:es|ed)|is\s+green)\b/i,
    /\b(?:typecheck|type\s+check|tsc)\s+(?:now\s+)?(?:succeed(?:s|ed)?|pass(?:es|ed)?|passing|is\s+clean)\b/i,
    // ko: 빌드(가/는) ... 성공/통과
    /빌드(?:가|는|도)?\s*\S{0,16}?\s*(?:성공|통과)/,
  ],
  negate: [
    /\b(?:not|never|should|won't|wont|don't|dont|doesn't|doesnt|didn't|didnt|can't|cant|couldn't|couldnt|fail)/i,
    /실패|못했|안\s*(?:됩|된|돼)|하지\s*(?:않|못)/,
  ],
};

/** Verbs that turn a sentence naming a path into a file-created claim. */
export const FILE_CREATED_VERBS: RegExp[] = [
  /\b(?:created?|creating|added|adding|wrote|writing|new\s+file)\b/i,
  // ko: 만들었/생성/추가
  /만들었|생성(?:했|합)|추가(?:했|합)/,
];

/** Verbs that turn a sentence naming a path into a negative-existence claim. */
export const FILE_REMOVED_VERBS: RegExp[] = [
  /\b(?:there\s+is\s+no|no\s+longer\s+exists?|doesn'?t\s+exist|removed|deleted|deleting)\b/i,
  // ko: 삭제/제거/없습니다/존재하지 않
  /삭제(?:했|합)|제거(?:했|합)|없습니다|존재하지\s*않/,
];

/** A URL plus one of these makes an endpoint-works claim. */
export const ENDPOINT_WORKS_VERBS: RegExp[] = [
  /\b(?:works?|working|returns?|responds?|responding|serves?|serving|is\s+(?:up|live|running)|operational)\b/i,
  // ko: 동작/작동/응답/정상
  /동작|작동|응답|정상/,
];

/** Sentence shape for env-set: env context + a set/add verb; the key is backticked UPPER_SNAKE. */
export const ENV_CONTEXT = /\.env|environment\s+variables?|환경\s*변수/i;
export const ENV_SET_VERBS: RegExp[] = [/\b(?:set|added|configured|updated)\b/i, /설정(?:했|합)|추가(?:했|합)/];
export const ENV_KEY = /`([A-Z][A-Z0-9_]{2,})`/;
