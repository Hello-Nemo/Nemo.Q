import { describe, it, expect } from 'vitest';
import { computeTrustLevel } from './trust-policy';

describe('computeTrustLevel', () => {
  it('should return trusted for certified semanticQuery', () => {
    const result = computeTrustLevel({
      toolName: 'semanticQuery',
      result: { audit: { isCertified: true } }
    });
    expect(result).toBe('trusted');
  });

  it('should return trusted_with_assumptions for non-certified semanticQuery', () => {
    const result = computeTrustLevel({
      toolName: 'semanticQuery',
      result: { audit: { isCertified: false } }
    });
    expect(result).toBe('trusted_with_assumptions');
  });

  it('should return exploratory for executeQuery', () => {
    const result = computeTrustLevel({
      toolName: 'executeQuery',
      result: { rows: [] }
    });
    expect(result).toBe('exploratory');
  });

  it('should return blocked if executedSql is false', () => {
    const result = computeTrustLevel({
      toolName: 'executeQuery',
      result: { executedSql: false }
    });
    expect(result).toBe('blocked');
  });

  it('should return blocked if guardStatus is failed', () => {
    const result = computeTrustLevel({
      toolName: 'executeQuery',
      result: { audit: { guardStatus: 'failed' } }
    });
    expect(result).toBe('blocked');
  });

  it('should return needs_confirmation if requires_action is true', () => {
    const result = computeTrustLevel({
      toolName: 'previewQueryPlan',
      result: { requires_action: true }
    });
    expect(result).toBe('needs_confirmation');
  });
});
