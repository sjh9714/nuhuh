import { describe, expect, test } from 'vitest';
import { runDemo } from '../src/demo.js';

describe('runDemo', () => {
  test('shows a receipt where true claims verify and false claims get caught', async () => {
    const result = await runDemo({ color: false });
    expect(result.receipt).toContain('✅');
    expect(result.receipt).toContain('❌');
    expect(result.exitCode).toBe(1);
  });
});
