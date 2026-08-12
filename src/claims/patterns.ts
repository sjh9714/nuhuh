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
    /\b(?:all\s+)?(?:\d+\s+)?tests?\s+(?:are\s+|still\s+|now\s+|all\s+)?pass(?:es|ing|ed)?\b/i,
    /\btest\s+suite\s+(?:is\s+)?(?:pass(?:es|ing|ed)?|green)\b/i,
    /\b(?:npm|yarn|pnpm|bun)\s+(?:run\s+)?test[\w:-]*\s+pass(?:es|ed|ing)?\b/i,
    // ko: 테스트(가/는/를/도) ... 통과/성공 (bounded gap so it stays inside the clause)
    /테스트(?:가|는|를|도)?.{0,24}?(?:통과|성공)/,
    // ja: テスト(は/が/も) ... 通り/成功/パス/合格
    /テスト(?:は|が|も)?.{0,24}?(?:通り|通っ|通過|成功|パス|合格)/,
    // zh: 测试 ... 通过
    /测试.{0,16}?通过/,
  ],
  negate: [
    /\b(?:not|never|should|won't|wont|don't|dont|doesn't|doesnt|didn't|didnt|can't|cant|couldn't|couldnt|unable\s+to)\s+(?:be\s+|all\s+)?pass/i,
    // Hypotheticals, denials, and sentences that mention the claim rather than
    // make it. Found live: an agent refusing to lie quoted "All tests pass"
    // and an early nuhuh would have blocked the honest refusal. Miss, don't accuse.
    /\bwould\b|\bfalse\b|\bisn'?t\s+true\b|\bnot\s+true\b|\bunverified\b|\bcan'?t\s+say\b|\bhaven'?t\s+(?:run|ran|verified)\b|\bnot\s+verified\b/i,
    // ko: any negation/failure marker in the sentence defeats the claim (miss, don't accuse)
    /않|못|실패|안\s*(?:됩|된|돼)/,
    // ja: negations, failures and hedges (はず/でしょう/かも) defeat the claim
    /ない|ません|失敗|はず|でしょう|かも/,
    // zh: negations, failures and hedges (应该/可能) defeat the claim
    /没有|没能|未|失败|不通过|没通过|无法|应该|可能|还没/,
  ],
};

export const BUILD_PASS: SentencePattern = {
  match: [
    /\bbuilds?\s+(?:now\s+)?(?:succeed(?:s|ed)?|pass(?:es|ed)?|passing|compil(?:es|ed)|is\s+green)\b/i,
    /\b(?:typecheck|type\s+check|tsc)\s+(?:now\s+)?(?:succeed(?:s|ed)?|pass(?:es|ed)?|passing|is\s+clean)\b/i,
    // ko: 빌드(가/는) ... 성공/통과
    /빌드(?:가|는|도)?\s*\S{0,16}?\s*(?:성공|통과)/,
    // ja: ビルド(は/が) ... 成功/通過/パス
    /ビルド(?:は|が|も)?.{0,16}?(?:成功|通過|通り|通っ|パス)/,
    // zh: 构建/编译 ... 成功/通过
    /(?:构建|编译).{0,12}?(?:成功|通过)/,
  ],
  negate: [
    /\b(?:not|never|should|won't|wont|don't|dont|doesn't|doesnt|didn't|didnt|can't|cant|couldn't|couldnt|fail)/i,
    /실패|못했|안\s*(?:됩|된|돼)|하지\s*(?:않|못)/,
    /ない|ません|失敗|はず|でしょう|かも/,
    /没有|没能|失败|无法|应该|可能|还没/,
  ],
};

export const LINT_PASS: SentencePattern = {
  match: [
    /\blint(?:er|ing)?(?:\s+(?:check|script|run))?\s+(?:pass(?:es|ed)?|passing|succeeds?|is\s+clean)/i,
    /\bpass(?:es|ed)?\s+(?:the\s+)?lint(?:er)?(?:\s+check)?\b/i,
    // ko: 린트(검사가) 통과
    /린트.{0,12}?(?:통과|성공)/,
    // ja: リント/リンター ... 通過/成功/パス/クリーン
    /(?:リント|リンター).{0,12}?(?:通過|成功|パス|クリーン)/,
    // zh: 代码检查 ... 通过/成功
    /(?:代码检查|静态检查).{0,12}?(?:通过|成功)/,
  ],
  negate: [
    /\b(?:not|never|should|won't|wont|don't|dont|doesn't|doesnt|didn't|didnt|can't|cant|couldn't|couldnt|fail|would)\b/i,
    /않|못|실패|안\s*(?:됩|된|돼)/,
    /ない|ません|失敗|はず|でしょう|かも/,
    /没有|没能|失败|无法|应该|可能|还没/,
  ],
};

/**
 * File claims use verb↔path ADJACENCY, not sentence-level attribution.
 * "removed the require from `index.js`" must not accuse index.js of being
 * deleted. The path right after the verb is the object, and anything further
 * away is context. Each regex captures the path in group 1.
 */
export const FILE_CREATED_ADJACENT: RegExp[] = [
  // "added `.env` to `.gitignore`" puts a STRING into a file, it does not
  // create the path, so a path followed by to/into/in is not a creation claim.
  /\b(?:created?|creating|adds?|added|adding|wrote|writing)\b[^`.!?]{0,40}`([^`]+)`(?!\s+(?:to|into|in)\b)/gi,
  // ko: `path` (파일)을 만들었/생성/추가
  /`([^`]+)`[^`]{0,20}?(?:만들었|생성(?:했|합)|추가(?:했|합))/g,
  // ja: `path` を作成/作り. 追加 is excluded on purpose, `x` を `y` に追加 puts
  // a line INTO y, so an addition verb cannot prove the path was created.
  /`([^`]+)`\s*(?:という(?:ファイル)?)?\s*を[^`]{0,16}?(?:作成|新規作成|作り)/g,
  // zh: 创建了/新建了/生成了 `path`. 添加 is excluded for the same reason.
  /(?:创建|新建|生成)了?[^`]{0,12}`([^`]+)`/g,
];

export const FILE_REMOVED_ADJACENT: RegExp[] = [
  /\b(?:deleted?|deleting|removed?|removing)\b\s+(?:the\s+)?(?:file\s+)?`([^`]+)`/gi,
  /\b(?:there\s+is\s+no|no\s+longer\s+exists?|doesn'?t\s+exist)\b[^`.!?]{0,20}`([^`]+)`/gi,
  // ko: `path` 삭제/제거/없습니다/존재하지 않
  /`([^`]+)`[^`]{0,20}?(?:삭제(?:했|합)|제거(?:했|합))/g,
  /`([^`]+)`[^`]{0,20}?(?:없습니다|존재하지\s*않)/g,
  // ja: `path` を削除/消去, `path` は(もう)存在しません/ありません
  /`([^`]+)`\s*(?:を|は)[^`]{0,12}?(?:削除|消去|除去|消し)/g,
  /`([^`]+)`[^`]{0,16}?(?:存在しません|(?:はもう|は)ありません)/g,
  // zh: 删除了/移除了 `path`, `path` (已)不存在/已删除
  /(?:删除|移除)了?[^`]{0,12}`([^`]+)`/g,
  /`([^`]+)`[^`]{0,12}?(?:不存在|已删除|已被删除)/g,
];

/**
 * Backticked tokens that are plausibly file paths, not code identifiers.
 * Live false accusations that shaped this: `process.argv`,
 * `JSON.stringify(data)`, `server.js:9-13`.
 */
const FILE_EXTENSIONS =
  /\.(?:m?[jt]sx?|c[jt]s|json|jsonc|md|mdx|py|rb|go|rs|java|kt|swift|c|h|cc|hh|cpp|hpp|cs|php|sh|bash|zsh|ya?ml|toml|ini|cfg|css|scss|less|html?|vue|svelte|sql|txt|xml|lock|gradle|properties|env|example|local|test|spec)$/i;

export function normalizePathToken(token: string): string | null {
  // strip a trailing line reference so server.js:9-13 becomes server.js
  const stripped = token.trim().replace(/:\d+(?:-\d+)?$/, '');
  if (stripped.length === 0 || /[\s()<>{}]/.test(stripped)) return null;
  const looksLikePath =
    stripped.includes('/') || FILE_EXTENSIONS.test(stripped) || stripped.startsWith('.env');
  return looksLikePath ? stripped : null;
}

/**
 * Words that declare completion without necessarily claiming anything
 * checkable. Used by the gate's opt-in strict mode: a done-declaration with
 * zero extractable claims is bounced with a request for checkable evidence.
 */
export const DONE_WORDS =
  /\b(?:done|complete[d]?|finished|implemented|fixed|verified|ready|works\s+now|now\s+works)\b|완료|끝났|구현했|수정했|검증했|完了|完成/i;

/** A URL plus one of these makes an endpoint-works claim. */
export const ENDPOINT_WORKS_VERBS: RegExp[] = [
  /\b(?:works?|working|returns?|responds?|responding|serves?|serving|is\s+(?:up|live|running)|operational)\b/i,
  // ko: 동작/작동/응답/정상
  /동작|작동|응답|정상/,
];

/** Sentence shape for env-set: env context + a set/add verb; the key is backticked UPPER_SNAKE. */
export const ENV_CONTEXT = /\.env|environment\s+variables?|환경\s*변수|環境変数|环境变量/i;
export const ENV_SET_VERBS: RegExp[] = [
  /\b(?:set|added|configured|updated)\b/i,
  /설정(?:했|합)|추가(?:했|합)/,
  /設定(?:しました|した|済み)/,
  /设置了?|配置了?/,
];
export const ENV_KEY = /`([A-Z][A-Z0-9_]{2,})`/;
