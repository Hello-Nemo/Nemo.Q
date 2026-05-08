import type { QueryPlan, SemanticLayer } from '../semantic/types';
import {
  BusinessConceptMap,
  ConceptMatch,
  mapBusinessConcepts,
} from './business-concept-mapper';
import { computeCandidateConfidence } from './candidate-confidence';
import {
  canDefaultExecuteIntentCandidate,
  rankIntentCandidates,
} from './intent-ranker';

export type IntentCandidateCoverage = {
  score: number;
  matchedConcepts: string[];
  missingConcepts: string[];
  ambiguousConcepts: string[];
};

export type IntentCandidate = {
  id: string;
  interpretation: string;
  plan: QueryPlan;
  confidence: number;
  coverage: IntentCandidateCoverage;
  assumptions: string[];
  canDefaultExecute: boolean;
};

function clampScore(value: number) {
  return Math.max(0, Math.min(1, value));
}

function roundScore(value: number) {
  return Math.round(clampScore(value) * 100) / 100;
}

function unique(items: string[]) {
  return Array.from(new Set(items.filter(Boolean)));
}

function hasRankingIntent(question: string) {
  return /最好|最强|最高|最大|最多|top|第一|排名|排行|榜/i.test(question);
}

function shouldLimitToTopOne(question: string) {
  return /哪个|哪一个|最高|最好|最强|top\s*1|第一/i.test(question);
}

function dimensionMatchesForMetric(args: {
  metric: ConceptMatch<'metric'>;
  conceptMap: BusinessConceptMap;
  semanticLayer: SemanticLayer;
}) {
  const dimensions = [...args.conceptMap.dimensions];

  if (args.metric.id === 'return_amount') {
    const returnMonth = args.semanticLayer.dimensions.return_month;
    return dimensions.map(dimension => {
      if (dimension.id !== 'order_month' || !returnMonth) return dimension;
      return {
        ...dimension,
        id: returnMonth.id,
        label: returnMonth.name,
        certified: returnMonth.certified === true,
        reason: '退货金额使用退货月份口径',
      };
    });
  }

  return dimensions;
}

function buildPlan(args: {
  question: string;
  metric: ConceptMatch<'metric'>;
  dimensions: ConceptMatch<'dimension'>[];
  conceptMap: BusinessConceptMap;
}): QueryPlan {
  const plan: QueryPlan = {
    intent: args.conceptMap.comparison ? 'comparison' : 'metric_query',
    metrics: [{ id: args.metric.id }],
    dimensions: args.dimensions.map(dimension => ({ id: dimension.id })),
    filters: [],
  };

  if (args.conceptMap.timeRange) {
    plan.timeRange = args.conceptMap.timeRange;
  }

  if (args.conceptMap.comparison) {
    plan.comparison = args.conceptMap.comparison;
  }

  if (hasRankingIntent(args.question)) {
    plan.orderBy = [{ field: args.metric.id, direction: 'desc' }];
    if (shouldLimitToTopOne(args.question)) {
      plan.limit = 1;
    }
  }

  return plan;
}

function computeCoverage(args: {
  metric: ConceptMatch<'metric'>;
  dimensions: ConceptMatch<'dimension'>[];
  conceptMap: BusinessConceptMap;
}): IntentCandidateCoverage {
  const dimensionScore = args.conceptMap.requestedConcepts.dimension
    ? Math.max(0, ...args.dimensions.map(dimension => dimension.strength))
    : 1;
  const timeScore = args.conceptMap.requestedConcepts.time
    ? (args.conceptMap.timeRange ? 1 : 0)
    : 1;
  const comparisonScore = args.conceptMap.requestedConcepts.comparison
    ? (args.conceptMap.comparison ? 1 : 0)
    : 1;
  const certifiedScore = args.metric.certified && args.dimensions.every(dimension => dimension.certified)
    ? 1
    : 0.75;

  const rawScore =
    args.metric.strength * 0.45 +
    dimensionScore * 0.2 +
    timeScore * 0.15 +
    comparisonScore * 0.1 +
    certifiedScore * 0.1 -
    args.conceptMap.missingConcepts.length * 0.3;

  return {
    score: roundScore(rawScore),
    matchedConcepts: unique([
      args.metric.label,
      ...args.dimensions.map(dimension => dimension.label),
      ...(args.conceptMap.timeRange?.value ? [args.conceptMap.timeRange.value] : []),
      ...(args.conceptMap.comparison?.type ? [args.conceptMap.comparison.type] : []),
    ]),
    missingConcepts: unique(args.conceptMap.missingConcepts),
    ambiguousConcepts: unique(args.conceptMap.ambiguousTerms),
  };
}

function describeAmbiguousAssumption(question: string, metric: ConceptMatch<'metric'>) {
  if (/业务表现/i.test(question)) {
    return `将“业务表现”优先解释为“${metric.label}”。`;
  }

  if (/表现/i.test(question)) {
    return `将“表现”优先解释为“${metric.label}”。`;
  }

  if (/情况|怎么样|如何/i.test(question)) {
    return `将泛化业务问题优先解释为“${metric.label}”。`;
  }

  if (/最好|最强|最高|最大|最多|top|第一/i.test(question)) {
    return `将“最好/最高”解释为按“${metric.label}”降序排序。`;
  }

  if (/排名|排行|榜/i.test(question)) {
    return `将“排名”解释为按“${metric.label}”降序排序。`;
  }

  return `候选业务口径为“${metric.label}”。`;
}

function buildAssumptions(args: {
  question: string;
  metric: ConceptMatch<'metric'>;
  dimensions: ConceptMatch<'dimension'>[];
  conceptMap: BusinessConceptMap;
}): string[] {
  const assumptions = [describeAmbiguousAssumption(args.question, args.metric)];

  if (args.dimensions.length > 0) {
    assumptions.push(`按“${args.dimensions.map(dimension => dimension.label).join('、')}”拆分结果。`);
  } else {
    assumptions.push('未指定拆分维度，默认汇总为整体指标。');
  }

  if (args.conceptMap.timeRange?.value) {
    assumptions.push(`时间范围按“${args.conceptMap.timeRange.value}”处理。`);
  } else {
    assumptions.push('未指定时间范围，默认覆盖当前可用全量数据。');
  }

  if (hasRankingIntent(args.question)) {
    assumptions.push(`排序依据为“${args.metric.label}”从高到低。`);
  }

  for (const missingConcept of args.conceptMap.missingConcepts) {
    assumptions.push(`当前语义层未覆盖“${missingConcept}”，该候选只能作为替代分析方向，不能按原口径自动执行。`);
  }

  return unique(assumptions);
}

function buildInterpretation(args: {
  metric: ConceptMatch<'metric'>;
  dimensions: ConceptMatch<'dimension'>[];
  conceptMap: BusinessConceptMap;
}) {
  const dimensionText = args.dimensions.length > 0
    ? `按${args.dimensions.map(dimension => dimension.label).join('、')}拆分`
    : '整体汇总';
  const timeText = args.conceptMap.timeRange?.value
    ? `，时间范围为 ${args.conceptMap.timeRange.value}`
    : '';
  const comparisonText = args.conceptMap.comparison?.type
    ? `，进行 ${args.conceptMap.comparison.type} 对比`
    : '';

  return `${dimensionText}的${args.metric.label}${timeText}${comparisonText}`;
}

function candidateId(args: {
  metric: ConceptMatch<'metric'>;
  dimensions: ConceptMatch<'dimension'>[];
  conceptMap: BusinessConceptMap;
}) {
  const dimensionIds = args.dimensions.map(dimension => dimension.id).join('-') || 'overall';
  const timeId = args.conceptMap.timeRange?.value || 'all-time';
  const comparisonId = args.conceptMap.comparison?.type || 'none';
  return `${args.metric.id}:${dimensionIds}:${timeId}:${comparisonId}`;
}

function ensureMetricCandidates(args: {
  conceptMap: BusinessConceptMap;
  semanticLayer: SemanticLayer;
}) {
  if (args.conceptMap.metrics.length > 0) {
    return args.conceptMap.metrics;
  }

  return Object.values(args.semanticLayer.metrics)
    .slice(0, 5)
    .map(metric => ({
      id: metric.id,
      kind: 'metric' as const,
      label: metric.name || metric.id,
      strength: 0.45,
      certified: metric.certified === true,
      reason: '未命中明确指标，提供低置信度候选',
    }));
}

export function generateIntentCandidates(args: {
  question: string;
  semanticLayer: SemanticLayer;
  maxCandidates?: number;
}) {
  const conceptMap = mapBusinessConcepts({
    question: args.question,
    semanticLayer: args.semanticLayer,
  });
  if (!conceptMap.requestedConcepts.metric) {
    return [];
  }

  const metricCandidates = ensureMetricCandidates({
    conceptMap,
    semanticLayer: args.semanticLayer,
  });

  const candidates = metricCandidates.slice(0, args.maxCandidates ?? 5).map(metric => {
    const dimensions = dimensionMatchesForMetric({
      metric,
      conceptMap,
      semanticLayer: args.semanticLayer,
    });
    const plan = buildPlan({
      question: args.question,
      metric,
      dimensions,
      conceptMap,
    });
    const coverage = computeCoverage({ metric, dimensions, conceptMap });
    const assumptions = buildAssumptions({
      question: args.question,
      metric,
      dimensions,
      conceptMap,
    });
    const confidence = computeCandidateConfidence({
      coverageScore: coverage.score,
      conceptStrength: metric.strength,
      certifiedConcepts: metric.certified && dimensions.every(dimension => dimension.certified),
      ambiguousConceptCount: coverage.ambiguousConcepts.length,
      missingConceptCount: coverage.missingConcepts.length,
      hasExplicitAssumptions: assumptions.length > 0,
    });

    const candidate: IntentCandidate = {
      id: candidateId({ metric, dimensions, conceptMap }),
      interpretation: buildInterpretation({ metric, dimensions, conceptMap }),
      plan,
      confidence,
      coverage,
      assumptions,
      canDefaultExecute: false,
    };

    return {
      ...candidate,
      canDefaultExecute: canDefaultExecuteIntentCandidate(candidate),
    };
  });

  return rankIntentCandidates(candidates).slice(0, args.maxCandidates ?? 5);
}

export function formatIntentCandidatesForPrompt(candidates: IntentCandidate[]) {
  const rankedCandidates = rankIntentCandidates(candidates).slice(0, 5);
  if (rankedCandidates.length === 0) return '';

  const defaultCandidate = rankedCandidates.find(candidate => candidate.canDefaultExecute) || null;
  const candidateLines = rankedCandidates.flatMap((candidate, index) => [
    `${index + 1}. ${candidate.interpretation}`,
    `   id=${candidate.id}`,
    `   confidence=${candidate.confidence}; coverage=${candidate.coverage.score}; defaultExecutable=${candidate.canDefaultExecute}`,
    `   plan=${JSON.stringify(candidate.plan)}`,
    `   assumptions=${candidate.assumptions.join(' | ')}`,
    candidate.coverage.missingConcepts.length > 0
      ? `   missingConcepts=${candidate.coverage.missingConcepts.join(', ')}`
      : '',
  ]).filter(Boolean);

  return [
    '<INTENT_CANDIDATE_RANKING>',
    `defaultExecutable=${defaultCandidate ? 'true' : 'false'}`,
    defaultCandidate ? `defaultCandidateId=${defaultCandidate.id}` : 'defaultCandidateId=none',
    '规则：如果 defaultExecutable=true，优先按 defaultCandidateId 对应候选的 plan 推进，并把 assumptions 写入工具 explanation/audit 假设；如果 defaultExecutable=false 或存在 missingConcepts，先澄清或提示缺少标准口径。',
    ...candidateLines,
    '</INTENT_CANDIDATE_RANKING>',
  ].join('\n');
}
