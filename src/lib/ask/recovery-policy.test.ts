import { describe, it, expect } from 'vitest';
import { computeRecoveryActions } from './recovery-policy';

describe('computeRecoveryActions', () => {
  it('should return similar metric actions for semantic compilation failure', () => {
    const actions = computeRecoveryActions({
      toolName: 'semanticQuery',
      result: { code: 'SEMANTIC_COMPILATION_FAILED' }
    });
    expect(actions.some(a => a.type === 'use_similar_metric')).toBe(true);
    expect(actions.some(a => a.type === 'request_certification')).toBe(true);
  });

  it('should return retry actions for guard failure', () => {
    const actions = computeRecoveryActions({
      toolName: 'executeQuery',
      result: { audit: { guardStatus: 'failed' } }
    });
    expect(actions.some(a => a.type === 'switch_to_aggregate')).toBe(true);
    expect(actions.some(a => a.type === 'retry_safely')).toBe(true);
  });

  it('should return confirm/cancel actions for previewQueryPlan', () => {
    const actions = computeRecoveryActions({
      toolName: 'previewQueryPlan',
      result: { requires_action: true }
    });
    expect(actions.some(a => a.type === 'confirm_plan')).toBe(true);
    expect(actions.some(a => a.type === 'cancel_plan')).toBe(true);
  });

  it('should return adjust_filters action for zero rows', () => {
    const actions = computeRecoveryActions({
      toolName: 'executeQuery',
      result: { rows: [] }
    });
    expect(actions.some(a => a.type === 'adjust_filters')).toBe(true);
  });
});
