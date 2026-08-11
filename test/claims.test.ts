import { describe, expect, test } from 'vitest';
import { extractClaims } from '../src/claims/extract.js';

describe('extractClaims: tests-pass', () => {
  test('extracts a tests-pass claim from "All tests pass"', () => {
    const claims = extractClaims('Done! All tests pass.');
    expect(claims).toHaveLength(1);
    expect(claims[0]).toMatchObject({
      type: 'tests-pass',
      quote: 'All tests pass.',
    });
  });

  test('regression: does not accuse an honest refusal that quotes the claim', () => {
    // Real sentence produced by a headless agent that was ASKED to lie and refused.
    // The gate must not punish honesty.
    const refusal =
      'I can\'t say that, because it isn\'t true — I haven\'t run any tests in this session, so "All tests pass" would be an unverified (and here, false) claim.';
    expect(extractClaims(refusal)).toHaveLength(0);
  });

  test('does not claim tests-pass for hypotheticals and denials', () => {
    expect(extractClaims('The tests would pass if the fixture existed.')).toHaveLength(0);
    expect(extractClaims('Saying "all tests pass" here would be false.')).toHaveLength(0);
    expect(extractClaims('I have not verified that the tests pass.')).toHaveLength(0);
  });

  test('does not claim tests-pass when the sentence is negated', () => {
    expect(extractClaims('Tests are not passing yet.')).toHaveLength(0);
    expect(extractClaims("The tests don't pass on CI.")).toHaveLength(0);
    expect(extractClaims('2 tests fail, the rest pass.')).toHaveLength(0);
    expect(extractClaims('Tests should pass now, but I could not run them.')).toHaveLength(0);
  });

  test('extracts Korean tests-pass claims', () => {
    for (const msg of [
      '테스트가 모두 통과했습니다.',
      '모든 테스트 통과!',
      '테스트 12개가 전부 통과합니다.',
    ]) {
      expect(extractClaims(msg), msg).toMatchObject([{ type: 'tests-pass' }]);
    }
  });

  test('does not claim tests-pass for negated Korean sentences', () => {
    expect(extractClaims('테스트가 통과하지 않습니다.')).toHaveLength(0);
    expect(extractClaims('테스트는 실행하지 못했습니다.')).toHaveLength(0);
  });

  test('extracts common passing phrasings', () => {
    for (const msg of [
      'All 12 tests pass.',
      'The test suite passes.',
      'Tests are passing now.',
      'All tests passed successfully.',
      'npm test passes.',
    ]) {
      expect(extractClaims(msg), msg).toMatchObject([{ type: 'tests-pass' }]);
    }
  });
});

describe('extractClaims: file-created', () => {
  test('extracts a file-created claim with the path as subject', () => {
    const claims = extractClaims('I created `src/api/users.ts` with the new endpoint.');
    expect(claims).toMatchObject([{ type: 'file-created', subject: 'src/api/users.ts' }]);
  });

  test('extracts Korean file-created claims', () => {
    const claims = extractClaims('`src/auth.ts` 파일을 만들었습니다.');
    expect(claims).toMatchObject([{ type: 'file-created', subject: 'src/auth.ts' }]);
  });

  test('extracts "added" as file-created', () => {
    const claims = extractClaims('Added `test/login.test.ts` covering the new flow.');
    expect(claims).toMatchObject([{ type: 'file-created', subject: 'test/login.test.ts' }]);
  });

  test('does not extract file-created without a path', () => {
    expect(extractClaims('I created a helper for that.')).toHaveLength(0);
  });
});

describe('extractClaims: build-pass', () => {
  test('extracts build success claims', () => {
    for (const msg of ['The build succeeds.', 'Build passes cleanly.', '빌드가 성공합니다.']) {
      expect(extractClaims(msg), msg).toMatchObject([{ type: 'build-pass' }]);
    }
  });

  test('does not extract negated build claims', () => {
    expect(extractClaims('The build does not succeed yet.')).toHaveLength(0);
  });
});

describe('extractClaims: endpoint-works', () => {
  test('extracts an endpoint claim with the URL as subject', () => {
    const claims = extractClaims('The endpoint at http://localhost:3000/api/users returns the user list.');
    expect(claims).toMatchObject([{ type: 'endpoint-works', subject: 'http://localhost:3000/api/users' }]);
  });

  test('extracts Korean endpoint claims', () => {
    const claims = extractClaims('http://localhost:8080/health 엔드포인트가 정상 동작합니다.');
    expect(claims).toMatchObject([{ type: 'endpoint-works', subject: 'http://localhost:8080/health' }]);
  });

  test('ignores URLs without a working/returning statement', () => {
    expect(extractClaims('See http://localhost:3000/docs for details.')).toHaveLength(0);
  });
});

describe('extractClaims: env-set', () => {
  test('extracts the env key that was claimed to be configured', () => {
    const claims = extractClaims('I set `DATABASE_URL` in the .env file.');
    expect(claims).toMatchObject([{ type: 'env-set', subject: 'DATABASE_URL' }]);
  });

  test('extracts "added X to .env" phrasing', () => {
    const claims = extractClaims('Added `STRIPE_KEY` to .env.');
    expect(claims).toMatchObject([{ type: 'env-set', subject: 'STRIPE_KEY' }]);
  });
});

describe('extractClaims: negative-existence', () => {
  test('extracts "there is no X" claims about files', () => {
    const claims = extractClaims('I checked — there is no `legacy/config.yml` anymore.');
    expect(claims).toMatchObject([{ type: 'negative-existence', subject: 'legacy/config.yml' }]);
  });

  test('extracts "removed/deleted X" claims', () => {
    const claims = extractClaims('Deleted `src/old-auth.ts` as requested.');
    expect(claims).toMatchObject([{ type: 'negative-existence', subject: 'src/old-auth.ts' }]);
  });

  test('attributes correctly when a sentence mixes creation and deletion', () => {
    const claims = extractClaims('Deleted `src/a.ts` and created `src/b.ts`.');
    expect(claims).toContainEqual(
      expect.objectContaining({ type: 'negative-existence', subject: 'src/a.ts' }),
    );
    expect(claims).toContainEqual(
      expect.objectContaining({ type: 'file-created', subject: 'src/b.ts' }),
    );
    expect(claims).toHaveLength(2);
  });

  test('regression: does not mark the file an import was removed FROM as deleted', () => {
    // Live false accusation: "removed the require from `index.js`" accused
    // index.js of still existing. index.js was the location, not the object.
    const claims = extractClaims('Deleted `legacy.js` and removed the require from `index.js`.');
    expect(claims).toContainEqual(
      expect.objectContaining({ type: 'negative-existence', subject: 'legacy.js' }),
    );
    expect(claims.some((c) => c.subject === 'index.js')).toBe(false);
  });
});

describe('extractClaims: path-shape guards (live false accusations)', () => {
  test('regression: backticked code identifiers are not file paths', () => {
    // Live: `process.argv` and `JSON.stringify(data)` were accused of not existing.
    expect(extractClaims('Added `process.argv` parsing.')).toHaveLength(0);
    expect(extractClaims('Added a `JSON.stringify(data)` call.')).toHaveLength(0);
  });

  test('regression: a line-ref suffix is stripped, not treated as part of the path', () => {
    // Live: `server.js:9-13` was accused of not existing.
    const claims = extractClaims('I added the /health route in `server.js:9-13`.');
    expect(claims).toMatchObject([{ type: 'file-created', subject: 'server.js' }]);
  });

  test('still accepts real paths with and without directories', () => {
    expect(extractClaims('Created `src/api/users.ts` today.')).toMatchObject([
      { subject: 'src/api/users.ts' },
    ]);
    expect(extractClaims('Created `server.js` today.')).toMatchObject([{ subject: 'server.js' }]);
    expect(extractClaims('Created `.env.example` today.')).toMatchObject([
      { subject: '.env.example' },
    ]);
  });
});

describe('extractClaims: multiple claims', () => {
  test('extracts every claim in a multi-sentence done message', () => {
    const msg =
      'Done! I created `src/api/users.ts` and added `test/users.test.ts`. All tests pass. The build succeeds.';
    const types = extractClaims(msg).map((c) => c.type);
    expect(types).toContain('tests-pass');
    expect(types).toContain('build-pass');
    expect(types.filter((t) => t === 'file-created')).toHaveLength(2);
  });
});
