import { parse } from 'pgsql-ast-parser';
import { Metric, SemanticLayer } from './types';

export type SemanticCoverageCode = 'SEMANTIC_COVERAGE_REQUIRED';

export interface SemanticAtomMatch {
  id: string;
  name: string;
  reason: 'sql_expression' | 'sql_alias' | 'context_text' | 'sql_field';
  expression?: string;
  column?: string;
  certified: boolean;
}

export interface SemanticCoverageAudit {
  coverageStatus: 'passed' | 'failed';
  reason: string;
  matchedMetrics: SemanticAtomMatch[];
  matchedDimensions: SemanticAtomMatch[];
  querySignals: {
    hasAggregation: boolean;
    hasGroupBy: boolean;
    tables: string[];
    fields: string[];
    aliases: string[];
  };
}

export type SemanticCoverageResult =
  | {
      coverageStatus: 'passed';
      executedSql: true;
      details: {
        reason: string;
        matchedMetrics: SemanticAtomMatch[];
        matchedDimensions: SemanticAtomMatch[];
      };
      audit: SemanticCoverageAudit;
    }
  | {
      coverageStatus: 'failed';
      executedSql: false;
      code: SemanticCoverageCode;
      error: string;
      hint: string;
      recoveryActions: ['listSemanticAtoms', 'semanticQuery'];
      details: {
        reason: string;
        matchedMetrics: SemanticAtomMatch[];
        matchedDimensions: SemanticAtomMatch[];
      };
      audit: SemanticCoverageAudit;
    };

interface DetectSemanticCoverageInput {
  sql: string;
  semanticLayer: SemanticLayer;
  question?: string;
  explanation?: string;
  assumptions?: string[];
  fields?: string[];
}

interface SqlSignals {
  hasAggregation: boolean;
  hasGroupBy: boolean;
  tables: Set<string>;
  fields: Set<string>;
  aliases: Set<string>;
  expressions: Set<string>;
}

const AGGREGATE_FUNCTIONS = new Set(['avg', 'count', 'max', 'min', 'sum']);

export function detectSemanticCoverage(input: DetectSemanticCoverageInput): SemanticCoverageResult {
  const signals = analyzeSql(input.sql);
  const guardFields = new Set((input.fields ?? []).map(normalizeQualifiedName));
  guardFields.forEach((field) => signals.fields.add(field));

  const contextText = normalizeSearchText([
    input.question,
    input.explanation,
    ...(input.assumptions ?? [])
  ].filter(Boolean).join(' '));

  const matchedMetrics = Object.values(input.semanticLayer.metrics)
    .filter((metric) => isCertified(metric))
    .map((metric) => matchMetric(metric, input.semanticLayer, signals, contextText))
    .filter((match): match is SemanticAtomMatch => Boolean(match));

  const matchedDimensions = Object.values(input.semanticLayer.dimensions)
    .map((dimension): SemanticAtomMatch | null => {
      const columnSignature = signatureFromExpression(dimension.transform || dimension.column);
      const normalizedColumn = normalizeQualifiedName(dimension.column);

      if (columnSignature && signals.expressions.has(columnSignature)) {
        return {
          id: dimension.id,
          name: dimension.name,
          reason: 'sql_expression' as const,
          expression: dimension.transform || dimension.column,
          certified: dimension.certified === true
        };
      }

      if (signals.fields.has(normalizedColumn)) {
        return {
          id: dimension.id,
          name: dimension.name,
          reason: 'sql_field' as const,
          column: dimension.column,
          certified: dimension.certified === true
        };
      }

      return null;
    })
    .filter((match): match is SemanticAtomMatch => Boolean(match));

  if (matchedMetrics.length > 0) {
    return buildBlockedResult(signals, matchedMetrics, matchedDimensions);
  }

  return buildPassedResult(signals, matchedDimensions);
}

function matchMetric(
  metric: Metric,
  semanticLayer: SemanticLayer,
  signals: SqlSignals,
  contextText: string
): SemanticAtomMatch | null {
  const resolvedExpression = resolveMetricExpression(metric, semanticLayer, new Set());
  const expressionSignatures = [
    signatureFromExpression(metric.expression),
    metric.formula ? signatureFromExpression(resolvedExpression) : null
  ].filter(Boolean) as string[];

  if (expressionSignatures.some((signature) => signals.expressions.has(signature))) {
    return {
      id: metric.id,
      name: metric.name,
      reason: 'sql_expression',
      expression: resolvedExpression,
      certified: true
    };
  }

  const normalizedAliases = new Set([
    normalizeSearchText(metric.id),
    normalizeSearchText(metric.name)
  ]);
  if (
    signals.hasAggregation &&
    Array.from(signals.aliases).some((alias) => normalizedAliases.has(alias))
  ) {
    return {
      id: metric.id,
      name: metric.name,
      reason: 'sql_alias',
      expression: resolvedExpression,
      certified: true
    };
  }

  const metricFields = collectQualifiedColumns(resolvedExpression).map(normalizeQualifiedName);
  const mentionsMetric = contextMentionsMetric(metric, contextText);
  const hasMetricFields =
    metricFields.length > 0 &&
    metricFields.every((field) => signals.fields.has(field));

  if (mentionsMetric && signals.hasAggregation && hasMetricFields) {
    return {
      id: metric.id,
      name: metric.name,
      reason: 'context_text',
      expression: resolvedExpression,
      certified: true
    };
  }

  return null;
}

function buildBlockedResult(
  signals: SqlSignals,
  matchedMetrics: SemanticAtomMatch[],
  matchedDimensions: SemanticAtomMatch[]
): SemanticCoverageResult {
  const audit = buildAudit(
    'failed',
    'certified_metric_covered_by_semantic_layer',
    signals,
    matchedMetrics,
    matchedDimensions
  );

  const metricsInfo = matchedMetrics
    .map((m) => `  - ${m.name} (id: ${m.id}): 语义定义为 \`${m.expression}\``)
    .join('\n');
  
  const dimensionsInfo = matchedDimensions.length > 0 
    ? `\n匹配到的维度：\n${matchedDimensions.map((d) => `  - ${d.name} (id: ${d.id}): 对应字段 \`${d.column || d.expression}\``).join('\n')}`
    : '';

  const hint = `拦截成功。检测到你正在查询认证指标，请改用 semanticQuery 以确保口径一致性。
匹配到的指标：
${metricsInfo}${dimensionsInfo}

请立即调用 semanticQuery 并根据上述 id 构造 QueryPlan。严禁手写 SQL 绕过。`;

  return {
    coverageStatus: 'failed',
    executedSql: false,
    code: 'SEMANTIC_COVERAGE_REQUIRED',
    error: '该查询应使用 semanticQuery',
    hint,
    recoveryActions: ['listSemanticAtoms', 'semanticQuery'],
    details: {
      reason: audit.reason,
      matchedMetrics,
      matchedDimensions
    },
    audit
  };
}

function buildPassedResult(
  signals: SqlSignals,
  matchedDimensions: SemanticAtomMatch[]
): SemanticCoverageResult {
  const audit = buildAudit(
    'passed',
    matchedDimensions.length > 0
      ? 'dimension_only_or_detail_query_allowed'
      : 'no_certified_metric_match',
    signals,
    [],
    matchedDimensions
  );

  return {
    coverageStatus: 'passed',
    executedSql: true,
    details: {
      reason: audit.reason,
      matchedMetrics: [],
      matchedDimensions
    },
    audit
  };
}

function buildAudit(
  coverageStatus: 'passed' | 'failed',
  reason: string,
  signals: SqlSignals,
  matchedMetrics: SemanticAtomMatch[],
  matchedDimensions: SemanticAtomMatch[]
): SemanticCoverageAudit {
  return {
    coverageStatus,
    reason,
    matchedMetrics,
    matchedDimensions,
    querySignals: {
      hasAggregation: signals.hasAggregation,
      hasGroupBy: signals.hasGroupBy,
      tables: Array.from(signals.tables).sort(),
      fields: Array.from(signals.fields).sort(),
      aliases: Array.from(signals.aliases).sort()
    }
  };
}

function analyzeSql(sql: string): SqlSignals {
  const signals: SqlSignals = {
    hasAggregation: false,
    hasGroupBy: false,
    tables: new Set(),
    fields: new Set(),
    aliases: new Set(),
    expressions: new Set()
  };

  let statements: any[];
  try {
    statements = parse(sql);
  } catch {
    return signals;
  }

  for (const statement of statements) {
    analyzeStatement(statement, signals, new Map());
  }

  return signals;
}

function analyzeStatement(statement: any, signals: SqlSignals, outerAliases: Map<string, string>) {
  if (!statement || typeof statement !== 'object') return;

  if (statement.type === 'with' || statement.type === 'with recursive') {
    for (const binding of statement.bind ?? []) {
      analyzeStatement(binding.statement, signals, outerAliases);
    }
    analyzeStatement(statement.in, signals, outerAliases);
    return;
  }

  if (statement.type === 'union') {
    analyzeStatement(statement.left, signals, outerAliases);
    analyzeStatement(statement.right, signals, outerAliases);
    return;
  }

  if (statement.type !== 'select') return;

  const aliases = new Map(outerAliases);
  for (const from of statement.from ?? []) {
    collectSourceAliases(from, signals, aliases);
  }

  if ((statement.groupBy?.length ?? 0) > 0 || statement.having) {
    signals.hasGroupBy = true;
    signals.hasAggregation = true;
  }

  for (const column of statement.columns ?? []) {
    if (column.alias?.name) {
      signals.aliases.add(normalizeSearchText(column.alias.name));
    }
    analyzeExpression(column.expr, signals, aliases);
  }

  analyzeExpression(statement.where, signals, aliases);
  analyzeExpression(statement.having, signals, aliases);
  analyzeExpression(statement.limit?.limit, signals, aliases);
  analyzeExpression(statement.limit?.offset, signals, aliases);

  for (const groupBy of statement.groupBy ?? []) {
    analyzeExpression(groupBy, signals, aliases);
  }

  for (const orderBy of statement.orderBy ?? []) {
    analyzeExpression(orderBy.by, signals, aliases);
  }
}

function collectSourceAliases(from: any, signals: SqlSignals, aliases: Map<string, string>) {
  if (!from || typeof from !== 'object') return;

  if (from.type === 'table') {
    const table = normalizeName(from.name?.name);
    if (table) {
      signals.tables.add(table);
      aliases.set(table, table);
      if (from.name?.alias) aliases.set(normalizeName(from.name.alias), table);
      if (from.alias) aliases.set(normalizeName(from.alias), table);
    }
  }

  if (from.type === 'statement') {
    analyzeStatement(from.statement, signals, aliases);
  }

  analyzeExpression(from.join?.on, signals, aliases);
}

function analyzeExpression(expr: any, signals: SqlSignals, aliases: Map<string, string>) {
  if (!expr || typeof expr !== 'object') return;

  const signature = expressionSignature(expr, aliases);
  if (signature) signals.expressions.add(signature);

  if (expr.type === 'ref') {
    const field = refSignature(expr, aliases);
    if (field) signals.fields.add(field);
    return;
  }

  if (expr.type === 'call') {
    const functionName = normalizeName(qualifiedName(expr.function));
    if (AGGREGATE_FUNCTIONS.has(functionName)) {
      signals.hasAggregation = true;
    }
  }

  for (const value of Object.values(expr)) {
    if (Array.isArray(value)) {
      value.forEach((item) => analyzeExpression(item, signals, aliases));
    } else {
      analyzeExpression(value, signals, aliases);
    }
  }
}

function signatureFromExpression(expression?: string): string | null {
  if (!expression) return null;

  try {
    const statement = parse(`SELECT ${expression}`)[0] as any;
    return expressionSignature(statement.columns[0].expr, new Map());
  } catch {
    return normalizeExpression(expression);
  }
}

function expressionSignature(expr: any, aliases: Map<string, string>): string {
  if (!expr || typeof expr !== 'object') return '';

  switch (expr.type) {
    case 'ref':
      return refSignature(expr, aliases);
    case 'call': {
      const functionName = normalizeName(qualifiedName(expr.function));
      const distinct = expr.distinct ? 'distinct ' : '';
      const args = (expr.args ?? [])
        .map((arg: any) => expressionSignature(arg, aliases))
        .join(',');
      return `${functionName}(${distinct}${args})`;
    }
    case 'binary':
      return `(${expressionSignature(expr.left, aliases)}${normalizeName(expr.op)}${expressionSignature(expr.right, aliases)})`;
    case 'unary':
      return `${normalizeName(expr.op)}${expressionSignature(expr.operand, aliases)}`;
    case 'integer':
    case 'numeric':
      return String(expr.value);
    case 'string':
      return `'${String(expr.value).toLowerCase()}'`;
    case 'cast':
      return expressionSignature(expr.operand, aliases);
    default:
      return normalizeExpression(JSON.stringify(expr));
  }
}

function refSignature(ref: any, aliases: Map<string, string>): string {
  const column = normalizeName(ref.name);
  const rawTable = ref.table?.name ? normalizeName(ref.table.name) : '';
  const table = rawTable ? aliases.get(rawTable) ?? rawTable : '';
  return table ? `${table}.${column}` : column;
}

function resolveMetricExpression(
  metric: Metric,
  semanticLayer: SemanticLayer,
  seen: Set<string>
): string {
  if (!metric.formula) return metric.expression;
  if (seen.has(metric.id)) return metric.expression;

  seen.add(metric.id);
  return metric.formula.replace(/{{(.*?)}}/g, (_match, metricId: string) => {
    const refMetric = semanticLayer.metrics[metricId];
    return refMetric
      ? `(${resolveMetricExpression(refMetric, semanticLayer, seen)})`
      : _match;
  });
}

function contextMentionsMetric(metric: Metric, contextText: string): boolean {
  if (!contextText) return false;

  return [metric.id, metric.name, metric.description]
    .filter((part) => part && normalizeSearchText(part).length >= 2)
    .some((part) => contextText.includes(normalizeSearchText(part)));
}

function collectQualifiedColumns(text?: string): string[] {
  if (!text) return [];
  return [...text.matchAll(/\b([a-zA-Z_][\w]*)\.([a-zA-Z_][\w]*)\b/g)].map((match) => match[0]);
}

function isCertified(metric: Metric): boolean {
  return metric.certified === true;
}

function qualifiedName(name: any): string {
  if (!name) return '';
  return [name.schema, name.name].filter(Boolean).join('.');
}

function normalizeQualifiedName(name: string): string {
  return normalizeName(name).replace(/\s+/g, '');
}

function normalizeExpression(expression: string): string {
  return normalizeName(expression).replace(/\s+/g, '');
}

function normalizeSearchText(text: string): string {
  return normalizeName(text).replace(/\s+/g, '');
}

function normalizeName(name: string): string {
  return String(name ?? '').toLowerCase();
}
