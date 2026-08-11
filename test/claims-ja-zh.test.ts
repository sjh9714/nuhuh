import { describe, expect, test } from 'vitest';
import { extractClaims } from '../src/claims/extract.js';

describe('Japanese claim extraction', () => {
  test('extracts tests-pass claims', () => {
    for (const msg of [
      'テストはすべて通りました。',
      '全テストが成功しました。',
      'テストは全部パスしています。',
    ]) {
      expect(extractClaims(msg), msg).toMatchObject([{ type: 'tests-pass' }]);
    }
  });

  test('does not claim tests-pass for negated or hedged sentences', () => {
    expect(extractClaims('テストは通りませんでした。')).toHaveLength(0);
    expect(extractClaims('テストは失敗しています。')).toHaveLength(0);
    expect(extractClaims('テストは通るはずです。')).toHaveLength(0);
    expect(extractClaims('テストはまだ実行していません。')).toHaveLength(0);
  });

  test('extracts build-pass claims', () => {
    expect(extractClaims('ビルドは成功しました。')).toMatchObject([{ type: 'build-pass' }]);
  });

  test('extracts file-created claims from verb adjacency', () => {
    expect(extractClaims('`src/login.ts` を作成しました。')).toMatchObject([
      { type: 'file-created', subject: 'src/login.ts' },
    ]);
  });

  test('a path that is the destination of an addition is not a creation claim', () => {
    // `.gitignore` に追加した = added INTO .gitignore, so .gitignore was not created
    expect(extractClaims('`.env` の行を `.gitignore` に追加しました。')).not.toMatchObject([
      { type: 'file-created', subject: '.gitignore' },
    ]);
  });

  test('extracts negative-existence claims', () => {
    expect(extractClaims('`legacy.js` を削除しました。')).toMatchObject([
      { type: 'negative-existence', subject: 'legacy.js' },
    ]);
    expect(extractClaims('`old.ts` はもう存在しません。')).toMatchObject([
      { type: 'negative-existence', subject: 'old.ts' },
    ]);
  });

  test('extracts env-set claims', () => {
    expect(extractClaims('環境変数 `DATABASE_URL` を .env に設定しました。')).toMatchObject([
      { type: 'env-set', subject: 'DATABASE_URL' },
    ]);
  });
});

describe('Chinese claim extraction', () => {
  test('extracts tests-pass claims', () => {
    for (const msg of ['所有测试都通过了。', '测试全部通过。', '测试已通过。']) {
      expect(extractClaims(msg), msg).toMatchObject([{ type: 'tests-pass' }]);
    }
  });

  test('does not claim tests-pass for negated or hedged sentences', () => {
    expect(extractClaims('测试没有通过。')).toHaveLength(0);
    expect(extractClaims('测试失败了。')).toHaveLength(0);
    expect(extractClaims('测试应该会通过。')).toHaveLength(0);
    expect(extractClaims('我还没有运行测试。')).toHaveLength(0);
  });

  test('extracts build-pass claims', () => {
    expect(extractClaims('构建成功。')).toMatchObject([{ type: 'build-pass' }]);
    expect(extractClaims('编译通过了。')).toMatchObject([{ type: 'build-pass' }]);
  });

  test('extracts file-created claims from verb adjacency', () => {
    expect(extractClaims('创建了 `src/login.ts`。')).toMatchObject([
      { type: 'file-created', subject: 'src/login.ts' },
    ]);
  });

  test('a path that is the destination of an addition is not a creation claim', () => {
    // 添加到 `.gitignore` = added INTO it, so .gitignore was not created
    const claims = extractClaims('把 `.env` 添加到了 `.gitignore`。');
    expect(claims.filter((c) => c.subject === '.gitignore')).toHaveLength(0);
  });

  test('extracts negative-existence claims', () => {
    expect(extractClaims('删除了 `legacy.js`。')).toMatchObject([
      { type: 'negative-existence', subject: 'legacy.js' },
    ]);
    expect(extractClaims('`old.ts` 已不存在。')).toMatchObject([
      { type: 'negative-existence', subject: 'old.ts' },
    ]);
  });

  test('extracts env-set claims', () => {
    expect(extractClaims('在 .env 中设置了环境变量 `DATABASE_URL`。')).toMatchObject([
      { type: 'env-set', subject: 'DATABASE_URL' },
    ]);
  });
});
