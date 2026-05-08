import type {
  Dimension,
  Metric,
  QueryPlan,
  SemanticLayer,
  TimeRange,
} from '../semantic/types';

export type ConceptMatchKind = 'metric' | 'dimension';

export type ConceptMatch<K extends ConceptMatchKind = ConceptMatchKind> = {
  id: string;
  kind: K;
  label: string;
  strength: number;
  certified: boolean;
  reason: string;
};

export type BusinessConceptMap = {
  question: string;
  normalizedQuestion: string;
  metrics: ConceptMatch<'metric'>[];
  dimensions: ConceptMatch<'dimension'>[];
  timeRange?: TimeRange;
  comparison?: NonNullable<QueryPlan['comparison']>;
  ambiguousTerms: string[];
  missingConcepts: string[];
  requestedConcepts: {
    metric: boolean;
    dimension: boolean;
    time: boolean;
    comparison: boolean;
  };
};

type AliasRule = {
  id: string;
  aliases: RegExp[];
  strength: number;
  reason: string;
};

const metricAliasRules: AliasRule[] = [
  {
    id: 'sales_amount',
    aliases: [/销售额/i, /销售表现/i, /销售/i, /成交额/i, /交易额/i, /收入/i, /营收/i, /gmv/i, /业绩/i],
    strength: 0.95,
    reason: '命中销售/收入类业务词',
  },
  {
    id: 'order_count',
    aliases: [/订单量/i, /订单数/i, /订单/i, /成交单数/i],
    strength: 0.9,
    reason: '命中订单规模类业务词',
  },
  {
    id: 'aov',
    aliases: [/客单价/i, /平均订单/i, /均单价/i, /每单/i],
    strength: 0.9,
    reason: '命中客单价类业务词',
  },
  {
    id: 'user_count',
    aliases: [/用户数/i, /客户数/i, /用户规模/i, /客户规模/i, /注册用户/i],
    strength: 0.88,
    reason: '命中用户规模类业务词',
  },
  {
    id: 'return_amount',
    aliases: [/退货金额/i, /退款金额/i, /退货/i, /退款/i],
    strength: 0.9,
    reason: '命中退货金额类业务词',
  },
];

const genericBusinessMetricFallbacks = [
  { id: 'sales_amount', strength: 0.78, reason: '业务表现的默认核心口径' },
  { id: 'order_count', strength: 0.68, reason: '业务表现的交易规模候选口径' },
  { id: 'user_count', strength: 0.6, reason: '业务表现的用户规模候选口径' },
  { id: 'aov', strength: 0.55, reason: '业务表现的效率候选口径' },
];

const dimensionAliasRules: AliasRule[] = [
  {
    id: 'user_country',
    aliases: [/国家/i, /国别/i, /地区/i, /地域/i],
    strength: 0.95,
    reason: '命中国家/地区拆分',
  },
  {
    id: 'product_category',
    aliases: [/产品类别/i, /产品分类/i, /品类/i, /类别/i, /分类/i],
    strength: 0.92,
    reason: '命中产品品类拆分',
  },
  {
    id: 'age_group',
    aliases: [/年龄段/i, /年龄/i, /客群/i],
    strength: 0.88,
    reason: '命中年龄/客群拆分',
  },
  {
    id: 'username',
    aliases: [/用户名/i, /用户名称/i, /客户名称/i],
    strength: 0.82,
    reason: '命中用户名称拆分',
  },
];

const unsupportedConceptRules = [
  { label: '毛利率', pattern: /毛利率|毛利/i },
  { label: '利润', pattern: /净利|利润/i },
  { label: '复购率', pattern: /复购率|复购/i },
  { label: '活跃用户', pattern: /活跃用户|活跃客户/i },
];

const ambiguousTermRules = [
  { label: '业务表现', pattern: /业务表现/i },
  { label: '表现', pattern: /表现/i },
  { label: '最好', pattern: /最好|最强|最高|最大|最多|top|第一/i },
  { label: '情况', pattern: /情况|怎么样|如何/i },
  { label: '贡献', pattern: /贡献|贡献度/i },
  { label: '排名', pattern: /排名|排行|榜/i },
];

function normalizeQuestion(question: string) {
  return question.trim().toLowerCase();
}

function clampScore(value: number) {
  return Math.max(0, Math.min(1, value));
}

function sortMatches<T extends ConceptMatch>(matches: T[]) {
  return [...matches].sort((a, b) => b.strength - a.strength || a.id.localeCompare(b.id));
}

function upsertMetricMatch(
  matches: Map<string, ConceptMatch<'metric'>>,
  metric: Metric | undefined,
  strength: number,
  reason: string
) {
  if (!metric) return;

  const existing = matches.get(metric.id);
  const next: ConceptMatch<'metric'> = {
    id: metric.id,
    kind: 'metric',
    label: metric.name || metric.id,
    strength: clampScore(strength),
    certified: metric.certified === true,
    reason,
  };

  if (!existing || next.strength > existing.strength) {
    matches.set(metric.id, next);
  }
}

function upsertDimensionMatch(
  matches: Map<string, ConceptMatch<'dimension'>>,
  dimension: Dimension | undefined,
  strength: number,
  reason: string
) {
  if (!dimension) return;

  const existing = matches.get(dimension.id);
  const next: ConceptMatch<'dimension'> = {
    id: dimension.id,
    kind: 'dimension',
    label: dimension.name || dimension.id,
    strength: clampScore(strength),
    certified: dimension.certified === true,
    reason,
  };

  if (!existing || next.strength > existing.strength) {
    matches.set(dimension.id, next);
  }
}

function detectTimeRange(question: string): TimeRange | undefined {
  if (/今天|今日/i.test(question)) return { type: 'preset', value: 'today' };
  if (/昨天|昨日/i.test(question)) return { type: 'preset', value: 'yesterday' };
  if (/近\s*7\s*天|最近\s*7\s*天|过去\s*7\s*天/i.test(question)) return { type: 'preset', value: 'last_7_days' };
  if (/近\s*30\s*天|最近\s*30\s*天|过去\s*30\s*天/i.test(question)) return { type: 'preset', value: 'last_30_days' };
  if (/本月|这个月/i.test(question)) return { type: 'preset', value: 'this_month' };
  if (/上个月|上月/i.test(question)) return { type: 'preset', value: 'last_month' };
  if (/今年|本年/i.test(question)) return { type: 'preset', value: 'this_year' };
  return undefined;
}

function detectComparison(question: string): NonNullable<QueryPlan['comparison']> | undefined {
  if (/同比|去年同期/i.test(question)) return { type: 'YoY' };
  if (/环比/i.test(question)) return { type: 'MoM' };
  return undefined;
}

function hasAnyPattern(question: string, patterns: RegExp[]) {
  return patterns.some(pattern => pattern.test(question));
}

function detectAmbiguousTerms(question: string) {
  return ambiguousTermRules
    .filter(rule => rule.pattern.test(question))
    .map(rule => rule.label);
}

function detectMissingConcepts(question: string) {
  return unsupportedConceptRules
    .filter(rule => rule.pattern.test(question))
    .map(rule => rule.label);
}

function shouldInferGenericBusinessMetrics(question: string) {
  return /业务表现|表现|情况|怎么样|如何|最好|最强|最高|最大|最多|top|第一|排名|排行|贡献/i.test(question);
}

function shouldUseReturnMonth(question: string) {
  return /退货|退款/i.test(question);
}

function shouldAddMonthlyDimension(question: string) {
  return /各月|按月|月度|月份|趋势|同比|环比/i.test(question);
}

export function mapBusinessConcepts(args: {
  question: string;
  semanticLayer: SemanticLayer;
}): BusinessConceptMap {
  const normalizedQuestion = normalizeQuestion(args.question);
  const metricMatches = new Map<string, ConceptMatch<'metric'>>();
  const dimensionMatches = new Map<string, ConceptMatch<'dimension'>>();

  for (const metric of Object.values(args.semanticLayer.metrics)) {
    if (
      normalizedQuestion.includes(metric.id.toLowerCase()) ||
      normalizedQuestion.includes(metric.name.toLowerCase())
    ) {
      upsertMetricMatch(metricMatches, metric, 1, `命中指标 ${metric.name}`);
    }
  }

  for (const rule of metricAliasRules) {
    if (hasAnyPattern(normalizedQuestion, rule.aliases)) {
      upsertMetricMatch(
        metricMatches,
        args.semanticLayer.metrics[rule.id],
        rule.strength,
        rule.reason
      );
    }
  }

  if (shouldInferGenericBusinessMetrics(normalizedQuestion)) {
    for (const fallback of genericBusinessMetricFallbacks) {
      upsertMetricMatch(
        metricMatches,
        args.semanticLayer.metrics[fallback.id],
        fallback.strength,
        fallback.reason
      );
    }
  }

  for (const dimension of Object.values(args.semanticLayer.dimensions)) {
    if (
      normalizedQuestion.includes(dimension.id.toLowerCase()) ||
      normalizedQuestion.includes(dimension.name.toLowerCase())
    ) {
      upsertDimensionMatch(dimensionMatches, dimension, 1, `命中维度 ${dimension.name}`);
    }
  }

  for (const rule of dimensionAliasRules) {
    if (hasAnyPattern(normalizedQuestion, rule.aliases)) {
      upsertDimensionMatch(
        dimensionMatches,
        args.semanticLayer.dimensions[rule.id],
        rule.strength,
        rule.reason
      );
    }
  }

  if (shouldAddMonthlyDimension(normalizedQuestion)) {
    const id = shouldUseReturnMonth(normalizedQuestion) ? 'return_month' : 'order_month';
    upsertDimensionMatch(
      dimensionMatches,
      args.semanticLayer.dimensions[id],
      0.88,
      '命中月度趋势拆分'
    );
  }

  const timeRange = detectTimeRange(normalizedQuestion);
  const comparison = detectComparison(normalizedQuestion);
  const ambiguousTerms = detectAmbiguousTerms(normalizedQuestion);
  const missingConcepts = detectMissingConcepts(normalizedQuestion);
  const metrics = sortMatches(Array.from(metricMatches.values()));
  const dimensions = sortMatches(Array.from(dimensionMatches.values()));

  return {
    question: args.question,
    normalizedQuestion,
    metrics,
    dimensions,
    timeRange,
    comparison,
    ambiguousTerms,
    missingConcepts,
    requestedConcepts: {
      metric: metrics.length > 0 || missingConcepts.length > 0 || shouldInferGenericBusinessMetrics(normalizedQuestion),
      dimension: dimensions.length > 0,
      time: !!timeRange,
      comparison: !!comparison,
    },
  };
}
