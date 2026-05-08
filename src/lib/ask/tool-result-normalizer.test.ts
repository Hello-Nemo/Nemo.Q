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

  it('should attach ranked intent candidates and surface default assumptions', () => {
    const result = normalizeToolResult({
      toolName: 'semanticQuery',
      input: {
        explanation: '哪个国家业务表现最好？',
        plan: {
          intent: 'metric_query',
          metrics: [{ id: 'sales_amount' }],
          dimensions: [{ id: 'user_country' }],
          filters: [],
          orderBy: [{ field: 'sales_amount', direction: 'desc' }],
          limit: 1,
        },
      },
      result: {
        rows: [{ country: 'US', sales_amount: 100 }],
        audit: {
          isCertified: true,
          assumptions: ['销售额口径为所有订单 total_price 的汇总。'],
        },
      },
    });

    expect(result.askMeta.intentCandidates?.length).toBeGreaterThan(0);
    expect(result.askMeta.defaultIntentCandidate?.plan.metrics[0]?.id).toBe('sales_amount');
    expect(result.audit.assumptions.join('\n')).toContain('业务表现');
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
