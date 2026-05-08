import { describe, it, expect } from 'vitest';
import { normalizeToolResult } from './tool-result-normalizer';

describe('normalizeToolResult', () => {
  it('should attach askMeta to semanticQuery results', () => {
    const result = normalizeToolResult({
      toolName: 'semanticQuery',
      result: { rows: [{ val: 100 }], audit: { isCertified: true } }
    });
    expect(result.askMeta).toBeDefined();
    expect(result.askMeta.answerPath).toBe('certified');
    expect(result.askMeta.trustLevel).toBe('trusted');
  });

  it('should handle guard failure correctly', () => {
    const result = normalizeToolResult({
      toolName: 'executeQuery',
      result: { error: 'Blocked', audit: { guardStatus: 'failed' } }
    });
    expect(result.askMeta.answerPath).toBe('guard_blocked');
    expect(result.askMeta.trustLevel).toBe('blocked');
    expect(result.askMeta.recoveryActions.length).toBeGreaterThan(0);
  });
});
