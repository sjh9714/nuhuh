import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { verifyMessage } from './app.js';

/**
 * A staged session: the "agent" makes four claims, two of them false,
 * inside a throwaway project — so anyone can watch nuhuh catch a lie
 * without having a real session on disk.
 */
export async function runDemo(opts: { color: boolean }): Promise<{
  receipt: string;
  exitCode: 0 | 1;
  message: string;
}> {
  const cwd = mkdtempSync(join(tmpdir(), 'nuhuh-demo-'));
  mkdirSync(join(cwd, 'src'));
  writeFileSync(join(cwd, 'src', 'login.ts'), 'export const login = () => true;\n');
  writeFileSync(
    join(cwd, 'package.json'),
    JSON.stringify(
      {
        name: 'demo-app',
        scripts: {
          // The suite the "agent" swears is green:
          test: 'node -e "console.error(\'Tests: 1 failed, 3 passed\'); process.exit(1)"',
          build: 'node -e "process.exit(0)"',
        },
      },
      null,
      2,
    ),
  );

  const message = [
    'Done! I created `src/login.ts` and added `src/login.test.ts` for coverage.',
    'All tests pass. The build succeeds.',
  ].join(' ');

  const { receipt, exitCode } = await verifyMessage(message, { cwd, color: opts.color });
  return { receipt, exitCode, message };
}
