import { describe, expect, it } from 'vitest';
import semanticLayer from '../semantic-layer.json' with { type: 'json' };
import type { SemanticLayer } from '../semantic/types';
import { mapBusinessConcepts } from './business-concept-mapper';
import { computeCandidateConfidence } from './candidate-confidence';
import {
  formatIntentCandidatesForPrompt,
  generateIntentCandidates,
} from './intent-candidates';
import {
  rankIntentCandidates,
  selectDefaultIntentCandidate,
} from './intent-ranker';

const layer = semanticLayer as SemanticLayer;

describe('intent candidate ranking', () => {
  it('maps fuzzy business wording to semantic concepts', () => {
    const conceptMap = mapBusinessConcepts({
      question: '今年各月销售表现怎么样？',
      semanticLayer: layer,
    });

    expect(conceptMap.metrics[0]?.id).toBe('sales_amount');
    expect(conceptMap.dimensions[0]?.id).toBe('order_month');
    expect(conceptMap.timeRange?.value).toBe('this_year');
    expect(conceptMap.ambiguousTerms).toContain('表现');
  });

  it('generates one to five ranked candidates with confidence, coverage, and assumptions', () => {
    const candidates = generateIntentCandidates({
      question: '哪个国家业务表现最好？',
      semanticLayer: layer,
    });

    expect(candidates.length).toBeGreaterThanOrEqual(1);
    expect(candidates.length).toBeLessThanOrEqual(5);

    for (const candidate of candidates) {
      expect(candidate.confidence).toBeGreaterThanOrEqual(0);
      expect(candidate.confidence).toBeLessThanOrEqual(1);
      expect(candidate.coverage.score).toBeGreaterThanOrEqual(0);
      expect(candidate.coverage.score).toBeLessThanOrEqual(1);
      expect(candidate.assumptions.length).toBeGreaterThan(0);
    }

    const [topCandidate] = candidates;
    expect(topCandidate.plan.metrics[0]?.id).toBe('sales_amount');
    expect(topCandidate.plan.dimensions[0]?.id).toBe('user_country');
    expect(topCandidate.interpretation).toContain('销售额');
    expect(topCandidate.assumptions.join('\n')).toContain('业务表现');
  });

  it('selects a default candidate only when confidence is high and assumptions are explicit', () => {
    const candidates = generateIntentCandidates({
      question: '哪个国家销售表现最好？',
      semanticLayer: layer,
    });

    const selected = selectDefaultIntentCandidate(candidates);

    expect(selected?.canDefaultExecute).toBe(true);
    expect(selected?.assumptions.length).toBeGreaterThan(0);
    expect(selected?.confidence).toBeGreaterThanOrEqual(0.72);
  });

  it('keeps semantic gaps from default execution', () => {
    const candidates = generateIntentCandidates({
      question: '毛利率最高的品类是什么？',
      semanticLayer: layer,
    });

    expect(candidates[0]?.coverage.missingConcepts).toContain('毛利率');
    expect(selectDefaultIntentCandidate(candidates)).toBeNull();
  });

  it('ranks by confidence and coverage', () => {
    const ranked = rankIntentCandidates([
      {
        id: 'low',
        interpretation: '低置信度候选',
        plan: {
          intent: 'metric_query',
          metrics: [{ id: 'order_count' }],
          dimensions: [],
          filters: [],
        },
        confidence: 0.4,
        coverage: { score: 0.8, matchedConcepts: [], missingConcepts: [], ambiguousConcepts: [] },
        assumptions: ['测试假设'],
        canDefaultExecute: false,
      },
      {
        id: 'high',
        interpretation: '高置信度候选',
        plan: {
          intent: 'metric_query',
          metrics: [{ id: 'sales_amount' }],
          dimensions: [],
          filters: [],
        },
        confidence: 0.9,
        coverage: { score: 0.7, matchedConcepts: [], missingConcepts: [], ambiguousConcepts: [] },
        assumptions: ['测试假设'],
        canDefaultExecute: true,
      },
    ]);

    expect(ranked[0].id).toBe('high');
  });

  it('penalizes missing concepts when computing confidence', () => {
    const confidence = computeCandidateConfidence({
      coverageScore: 0.9,
      conceptStrength: 0.9,
      certifiedConcepts: true,
      ambiguousConceptCount: 0,
      missingConceptCount: 1,
      hasExplicitAssumptions: true,
    });

    expect(confidence).toBeLessThan(0.72);
  });

  it('formats candidates for runtime prompt context with default assumptions', () => {
    const candidates = generateIntentCandidates({
      question: '哪个国家业务表现最好？',
      semanticLayer: layer,
    });

    const context = formatIntentCandidatesForPrompt(candidates);

    expect(context).toContain('<INTENT_CANDIDATE_RANKING>');
    expect(context).toContain('defaultExecutable=true');
    expect(context).toContain('业务表现');
  });

  it('does not generate business candidates for non-business chatter', () => {
    const candidates = generateIntentCandidates({
      question: '你好，先聊两句',
      semanticLayer: layer,
    });

    expect(candidates).toEqual([]);
    expect(formatIntentCandidatesForPrompt(candidates)).toBe('');
  });
});
