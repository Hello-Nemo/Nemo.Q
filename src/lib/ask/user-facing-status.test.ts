import { describe, it, expect } from 'vitest';
import { toUserFacingStatus } from './user-facing-status';

describe('toUserFacingStatus', () => {
  it('should return warning for semantic compilation failure', () => {
    const status = toUserFacingStatus({
      toolName: 'semanticQuery',
      result: { code: 'SEMANTIC_COMPILATION_FAILED' }
    });
    expect(status.severity).toBe('warning');
    expect(status.title).toContain('没有认证口径');
  });

  it('should return warning for guard failure', () => {
    const status = toUserFacingStatus({
      toolName: 'executeQuery',
      result: { audit: { guardStatus: 'failed' } }
    });
    expect(status.severity).toBe('warning');
    expect(status.title).toContain('安全方式');
  });

  it('should return info for exploratory executeQuery', () => {
    const status = toUserFacingStatus({
      toolName: 'executeQuery',
      result: { rows: [{ id: 1 }] }
    });
    expect(status.severity).toBe('info');
    expect(status.title).toBe('探索性结果');
  });

  it('should return success for normal semanticQuery results', () => {
    const status = toUserFacingStatus({
      toolName: 'semanticQuery',
      result: { rows: [{ count: 10 }] }
    });
    expect(status.severity).toBe('success');
  });
});
