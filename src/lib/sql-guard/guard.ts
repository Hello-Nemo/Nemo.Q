import { parse } from 'pgsql-ast-parser';
import { SemanticLayer } from '../semantic/types';

export type SqlGuardCode =
  | 'DANGEROUS_FUNCTION'
  | 'INVALID_SQL'
  | 'MULTIPLE_STATEMENTS'
  | 'NON_READONLY_SQL'
  | 'UNAUTHORIZED_FIELD'
  | 'UNAUTHORIZED_TABLE'
  | 'UNSUPPORTED_SQL'
  | 'WILDCARD_NOT_ALLOWED';

export interface SqlGuardPolicy {
  allowedTables: Set<string>;
  allowedColumnsByTable: Map<string, Set<string>>;
  defaultLimit: number;
}

interface SqlGuardAudit {
  guardStatus: 'passed' | 'failed';
  tables: string[];
  fields: string[];
  limitApplied: boolean;
  readonly: boolean;
  explain: {
    status: 'not_run' | 'skipped';
    reason: string;
  };
}

export interface SqlGuardSuccess {
  guardStatus: 'passed';
  executedSql: true;
  sql: string;
  originalSql: string;
  audit: SqlGuardAudit;
}

export interface SqlGuardFailure {
  guardStatus: 'failed';
  executedSql: false;
  code: SqlGuardCode;
  message: string;
  originalSql: string;
  audit: SqlGuardAudit & {
    code: SqlGuardCode;
    message: string;
  };
  details?: Record<string, unknown>;
}

export type SqlGuardResult = SqlGuardSuccess | SqlGuardFailure;

type Source =
  | { kind: 'table'; table: string }
  | { kind: 'cte'; name: string; columns: Set<string> }
  | { kind: 'subquery'; alias: string; columns: Set<string> };

interface ValidationState {
  policy: SqlGuardPolicy;
  tables: Set<string>;
  fields: Set<string>;
}

interface SelectScope {
  sources: Map<string, Source>;
  ctes: Map<string, Set<string>>;
  outputAliases?: Set<string>;
}

class GuardError extends Error {
  constructor(
    readonly code: SqlGuardCode,
    message: string,
    readonly details?: Record<string, unknown>
  ) {
    super(message);
  }
}

const AGGREGATE_FUNCTIONS = new Set(['avg', 'count', 'max', 'min', 'sum']);
const DANGEROUS_FUNCTIONS = new Set([
  'copy',
  'dblink',
  'dblink_connect',
  'lo_export',
  'lo_import',
  'pg_ls_dir',
  'pg_read_binary_file',
  'pg_read_file',
  'pg_sleep',
  'pg_stat_file'
]);

export function buildSqlGuardPolicy(
  semanticLayer: SemanticLayer,
  defaultLimit: number = 1000
): SqlGuardPolicy {
  const allowedTables = new Set<string>();
  const allowedColumnsByTable = new Map<string, Set<string>>();

  const allowColumn = (qualifiedColumn?: string) => {
    if (!qualifiedColumn) return;
    const match = qualifiedColumn.match(/\b([a-zA-Z_][\w]*)\.([a-zA-Z_][\w]*)\b/);
    if (!match) return;

    const [, table, column] = match;
    allowedTables.add(table);
    if (!allowedColumnsByTable.has(table)) {
      allowedColumnsByTable.set(table, new Set());
    }
    allowedColumnsByTable.get(table)!.add(column);
  };

  Object.values(semanticLayer.entities).forEach((entity) => {
    allowedTables.add(entity.table);
    allowColumn(`${entity.table}.${entity.primaryKey}`);
    allowColumn(entity.defaultTimeColumn);
  });

  Object.values(semanticLayer.metrics).forEach((metric) => {
    collectQualifiedColumns(metric.expression).forEach(allowColumn);
    collectQualifiedColumns(metric.formula).forEach(allowColumn);
    allowColumn(metric.timeColumn);
  });

  Object.values(semanticLayer.dimensions).forEach((dimension) => {
    collectQualifiedColumns(dimension.column).forEach(allowColumn);
    collectQualifiedColumns(dimension.transform).forEach(allowColumn);
  });

  semanticLayer.relationships.forEach((relationship) => {
    collectQualifiedColumns(relationship.joinOn).forEach(allowColumn);
  });

  Object.entries(semanticLayer.columns ?? {}).forEach(([table, columns]) => {
    Object.keys(columns).forEach((column) => allowColumn(`${table}.${column}`));
  });

  Object.entries((semanticLayer as any).tables ?? {}).forEach(([table, tableMeta]: [string, any]) => {
    Object.keys(tableMeta.columns ?? {}).forEach((column) => allowColumn(`${table}.${column}`));
  });

  return {
    allowedTables,
    allowedColumnsByTable,
    defaultLimit
  };
}

export function guardSql(sql: string, policy: SqlGuardPolicy): SqlGuardResult {
  const originalSql = sql;
  const normalizedSql = normalizeSql(sql);
  const emptyAudit = buildAudit('failed', [], [], false);

  if (!normalizedSql) {
    return fail('INVALID_SQL', 'SQL 不能为空。', originalSql, emptyAudit);
  }

  let statements: any[];
  try {
    statements = parse(normalizedSql);
  } catch (error: any) {
    const keywordCode = readonlyKeywordCode(normalizedSql);
    return fail(
      keywordCode ?? 'INVALID_SQL',
      keywordCode ? '仅允许执行 SELECT 或 WITH ... SELECT 查询。' : `SQL 解析失败: ${error.message}`,
      originalSql,
      emptyAudit,
      { parserMessage: error.message }
    );
  }

  if (statements.length !== 1) {
    return fail(
      'MULTIPLE_STATEMENTS',
      'SQL Guard 拒绝多语句执行；请只提交一条 SELECT 查询。',
      originalSql,
      emptyAudit,
      { statementCount: statements.length }
    );
  }

  const state: ValidationState = {
    policy,
    tables: new Set(),
    fields: new Set()
  };

  try {
    const statement = statements[0];
    assertReadOnlySelect(statement);
    validateSelectStatement(statement, state, new Map());

    const limitApplied = shouldAppendDefaultLimit(statement);
    const guardedSql = limitApplied
      ? `${stripTrailingSemicolonAndComments(normalizedSql)} LIMIT ${policy.defaultLimit}`
      : stripTrailingSemicolon(normalizedSql);

    return {
      guardStatus: 'passed',
      executedSql: true,
      sql: guardedSql,
      originalSql,
      audit: buildAudit(
        'passed',
        Array.from(state.tables).sort(),
        Array.from(state.fields).sort(),
        limitApplied
      )
    };
  } catch (error) {
    if (error instanceof GuardError) {
      return fail(
        error.code,
        error.message,
        originalSql,
        buildAudit(
          'failed',
          Array.from(state.tables).sort(),
          Array.from(state.fields).sort(),
          false
        ),
        error.details
      );
    }

    throw error;
  }
}

function validateSelectStatement(
  statement: any,
  state: ValidationState,
  ctes: Map<string, Set<string>>
): Set<string> {
  switch (statement.type) {
    case 'with':
    case 'with recursive':
      return validateWith(statement, state, ctes);
    case 'select':
      return validateSelect(statement, state, ctes);
    case 'union': {
      const left = validateSelectStatement(statement.left, state, ctes);
      validateSelectStatement(statement.right, state, ctes);
      return left;
    }
    default:
      throw new GuardError(
        'UNSUPPORTED_SQL',
        'SQL Guard 仅支持 SELECT 或 WITH ... SELECT 查询。',
        { statementType: statement.type }
      );
  }
}

function validateWith(
  statement: any,
  state: ValidationState,
  outerCtes: Map<string, Set<string>>
): Set<string> {
  const scopedCtes = new Map(outerCtes);

  for (const binding of statement.bind ?? []) {
    assertReadOnlySelect(binding.statement);
    const columns = validateSelectStatement(binding.statement, state, scopedCtes);
    scopedCtes.set(normalizeName(binding.alias.name), columns);
  }

  assertReadOnlySelect(statement.in);
  return validateSelectStatement(statement.in, state, scopedCtes);
}

function validateSelect(
  statement: any,
  state: ValidationState,
  ctes: Map<string, Set<string>>
): Set<string> {
  if (statement.for) {
    throw new GuardError('NON_READONLY_SQL', 'SQL Guard 拒绝 SELECT ... FOR UPDATE/SHARE 锁定查询。');
  }

  const sources = buildSources(statement.from ?? [], state, ctes);
  const selectedAliases = collectSelectedAliases(statement.columns ?? []);
  const scope: SelectScope = { sources, ctes, outputAliases: selectedAliases };

  for (const column of statement.columns ?? []) {
    validateExpression(column.expr, state, { sources, ctes }, false, false);
  }

  validateExpression(statement.where, state, scope, false, true);
  validateExpression(statement.having, state, scope, false, false);
  validateExpression(statement.limit?.limit, state, scope, false, false);
  validateExpression(statement.limit?.offset, state, scope, false, false);

  for (const groupBy of statement.groupBy ?? []) {
    validateExpression(groupBy, state, scope, false, false);
  }

  for (const orderBy of statement.orderBy ?? []) {
    validateExpression(orderBy.by, state, scope, false, false);
  }

  return buildOutputColumns(statement.columns ?? []);
}

function buildSources(
  fromItems: any[],
  state: ValidationState,
  ctes: Map<string, Set<string>>
): Map<string, Source> {
  const sources = new Map<string, Source>();

  for (const from of fromItems) {
    const source = sourceFrom(from, state, ctes);
    addSource(sources, source, sourceAlias(from, source));
  }

  const scope: SelectScope = { sources, ctes };
  for (const from of fromItems) {
    if (from.join?.using) {
      for (const column of from.join.using) {
        validateUnqualifiedField(column.name, state, scope);
      }
    }
    validateExpression(from.join?.on, state, scope, false, true);
  }

  return sources;
}

function sourceFrom(from: any, state: ValidationState, ctes: Map<string, Set<string>>): Source {
  if (from.type === 'table') {
    const tableName = normalizeName(from.name.name);
    const cteColumns = ctes.get(tableName);

    if (cteColumns) {
      return { kind: 'cte', name: tableName, columns: cteColumns };
    }

    if (!state.policy.allowedTables.has(tableName)) {
      throw new GuardError(
        'UNAUTHORIZED_TABLE',
        `SQL Guard 拒绝未授权表: ${tableName}`,
        { table: tableName }
      );
    }

    state.tables.add(tableName);
    return { kind: 'table', table: tableName };
  }

  if (from.type === 'statement') {
    const columns = validateSelectStatement(from.statement, state, ctes);
    const alias = from.alias?.name || from.alias;
    return { kind: 'subquery', alias: normalizeName(alias), columns };
  }

  if (from.type === 'call') {
    assertSafeFunction(from.function);
    throw new GuardError(
      'UNSUPPORTED_SQL',
      'SQL Guard 暂不允许 FROM 中使用函数或表值函数。',
      { function: qualifiedName(from.function) }
    );
  }

  throw new GuardError(
    'UNSUPPORTED_SQL',
    'SQL Guard 暂不支持该 FROM 来源。',
    { fromType: from.type }
  );
}

function addSource(sources: Map<string, Source>, source: Source, alias: string) {
  sources.set(normalizeName(alias), source);

  if (source.kind === 'table') {
    sources.set(source.table, source);
  }

  if (source.kind === 'cte') {
    sources.set(source.name, source);
  }
}

function sourceAlias(from: any, source: Source): string {
  if (from.name?.alias?.name) return from.name.alias.name;
  if (from.name?.alias) return from.name.alias;
  if (from.alias?.name) return from.alias.name;
  if (from.alias) return from.alias;
  if (source.kind === 'table') return source.table;
  if (source.kind === 'cte') return source.name;
  return source.alias;
}

function validateExpression(
  expr: any, 
  state: ValidationState, 
  scope: SelectScope, 
  allowWildcard: boolean,
  isWhereClause: boolean = false
): void {
  if (!expr || typeof expr !== 'object') return;

  switch (expr.type) {
    case 'ref':
      validateRef(expr, state, scope, allowWildcard, isWhereClause);
      return;
    case 'call': {
      const funcName = normalizeName(qualifiedName(expr.function));
      const isCount = funcName === 'count';
      assertSafeFunction(expr.function);
      for (const arg of expr.args ?? []) validateExpression(arg, state, scope, isCount, isWhereClause);
      validateExpression(expr.filter, state, scope, false, isWhereClause);
      for (const orderBy of expr.orderBy ?? []) validateExpression(orderBy.by, state, scope, false, false);
      if (expr.over) {
        for (const orderBy of expr.over.orderBy ?? []) validateExpression(orderBy.by, state, scope, false, false);
        for (const partitionBy of expr.over.partitionBy ?? []) {
          validateExpression(partitionBy, state, scope, false, false);
        }
      }
      return;
    }
    case 'select':
    case 'with':
    case 'with recursive':
    case 'union':
      validateSelectStatement(expr, state, scope.ctes);
      return;
    default:
      for (const value of Object.values(expr)) {
        if (Array.isArray(value)) {
          for (const item of value) validateExpression(item, state, scope, false, isWhereClause);
        } else {
          validateExpression(value, state, scope, false, isWhereClause);
        }
      }
  }
}

function validateRef(
  ref: any, 
  state: ValidationState, 
  scope: SelectScope, 
  allowWildcard: boolean,
  isWhereClause: boolean
): void {
  const column = normalizeName(ref.name);

  if (column === '*') {
    if (allowWildcard) return;
    throw new GuardError('WILDCARD_NOT_ALLOWED', 'SQL Guard 禁止 SELECT *，请显式列出已授权字段。');
  }

  if (ref.table?.name) {
    validateQualifiedField(normalizeName(ref.table.name), column, state, scope);
    return;
  }

  if (!isWhereClause && scope.outputAliases?.has(column)) {
    return;
  }

  validateUnqualifiedField(column, state, scope);
}

function validateQualifiedField(
  sourceName: string,
  column: string,
  state: ValidationState,
  scope: SelectScope
): void {
  const source = scope.sources.get(sourceName);

  if (!source) {
    throw new GuardError(
      'UNAUTHORIZED_TABLE',
      `SQL Guard 拒绝未授权或未知来源: ${sourceName}`,
      { source: sourceName, column }
    );
  }

  if (source.kind === 'table') {
    assertAllowedColumn(source.table, column, state);
    return;
  }

  if (!source.columns.has(column)) {
    throw new GuardError(
      'UNAUTHORIZED_FIELD',
      `SQL Guard 拒绝未授权字段: ${sourceName}.${column}`,
      { source: sourceName, column }
    );
  }
}

function validateUnqualifiedField(column: string, state: ValidationState, scope: SelectScope): void {
  const matches: Source[] = [];

  for (const source of uniqueSources(scope.sources)) {
    if (source.kind === 'table') {
      const allowedColumns = state.policy.allowedColumnsByTable.get(source.table);
      if (allowedColumns?.has(column)) matches.push(source);
      continue;
    }

    if (source.columns.has(column)) matches.push(source);
  }

  if (matches.length !== 1) {
    throw new GuardError(
      'UNAUTHORIZED_FIELD',
      matches.length > 1
        ? `SQL Guard 拒绝未限定且有歧义的字段: ${column}`
        : `SQL Guard 拒绝未授权字段: ${column}`,
      { column, matchCount: matches.length }
    );
  }

  const [source] = matches;
  if (source.kind === 'table') {
    assertAllowedColumn(source.table, column, state);
  }
}

function assertAllowedColumn(table: string, column: string, state: ValidationState): void {
  const allowedColumns = state.policy.allowedColumnsByTable.get(table);

  if (!allowedColumns?.has(column)) {
    throw new GuardError(
      'UNAUTHORIZED_FIELD',
      `SQL Guard 拒绝未授权字段: ${table}.${column}`,
      { table, column }
    );
  }

  state.fields.add(`${table}.${column}`);
}

function assertReadOnlySelect(statement: any): void {
  if (statement.type === 'with' || statement.type === 'with recursive') {
    for (const binding of statement.bind ?? []) {
      assertReadOnlySelect(binding.statement);
    }
    assertReadOnlySelect(statement.in);
    return;
  }

  if (statement.type === 'select' || statement.type === 'union') return;

  throw new GuardError(
    'NON_READONLY_SQL',
    'SQL Guard 仅允许 SELECT 或 WITH ... SELECT 查询，禁止写入或 DDL 操作。',
    { statementType: statement.type }
  );
}

function assertSafeFunction(fn: any): void {
  const name = normalizeName(qualifiedName(fn));

  if (DANGEROUS_FUNCTIONS.has(name)) {
    throw new GuardError(
      'DANGEROUS_FUNCTION',
      `SQL Guard 拒绝危险函数: ${name}`,
      { function: name }
    );
  }
}

function shouldAppendDefaultLimit(statement: any): boolean {
  return !hasTopLevelLimit(statement) && !hasAggregation(statement);
}

function hasTopLevelLimit(statement: any): boolean {
  if (statement.type === 'select') return Boolean(statement.limit?.limit);
  if (statement.type === 'with' || statement.type === 'with recursive') return hasTopLevelLimit(statement.in);
  return false;
}

function hasAggregation(node: any): boolean {
  if (!node || typeof node !== 'object') return false;

  if (node.type === 'select' && ((node.groupBy?.length ?? 0) > 0 || node.having)) {
    return true;
  }

  if (node.type === 'call' && AGGREGATE_FUNCTIONS.has(normalizeName(qualifiedName(node.function)))) {
    return true;
  }

  return Object.values(node).some((value) => {
    if (Array.isArray(value)) return value.some(hasAggregation);
    return hasAggregation(value);
  });
}

function buildOutputColumns(columns: any[]): Set<string> {
  return new Set(
    columns.map((column, index) => normalizeName(outputColumnName(column, index))).filter(Boolean)
  );
}

function collectSelectedAliases(columns: any[]): Set<string> {
  return new Set(
    columns
      .map((column) => column.alias?.name)
      .filter(Boolean)
      .map((name: string) => normalizeName(name))
  );
}

function outputColumnName(column: any, index: number): string {
  if (column.alias?.name) return column.alias.name;
  if (column.expr?.type === 'ref') return column.expr.name;
  return `column_${index + 1}`;
}

function uniqueSources(sourceMap: Map<string, Source>): Source[] {
  return Array.from(new Set(sourceMap.values()));
}

function collectQualifiedColumns(text?: string): string[] {
  if (!text) return [];
  return [...text.matchAll(/\b([a-zA-Z_][\w]*)\.([a-zA-Z_][\w]*)\b/g)].map((match) => match[0]);
}

function qualifiedName(name: any): string {
  if (!name) return '';
  return [name.schema, name.name].filter(Boolean).join('.');
}

function normalizeName(name: string): string {
  return String(name).toLowerCase();
}

function normalizeSql(sql: string): string {
  return sql.trim();
}

function stripTrailingSemicolon(sql: string): string {
  return sql.replace(/;\s*$/, '').trim();
}

function stripTrailingSemicolonAndComments(sql: string): string {
  return sql.replace(/(--.*|;\s*|(\/\*[\s\S]*?\*\/))$/g, '').trim();
}

function readonlyKeywordCode(sql: string): SqlGuardCode | undefined {
  const firstKeyword = sql.match(/^\s*([a-zA-Z]+)/)?.[1]?.toLowerCase();
  if (!firstKeyword) return undefined;
  if (firstKeyword !== 'select' && firstKeyword !== 'with') return 'NON_READONLY_SQL';
  return undefined;
}

function buildAudit(
  guardStatus: 'passed' | 'failed',
  tables: string[],
  fields: string[],
  limitApplied: boolean
): SqlGuardAudit {
  return {
    guardStatus,
    tables,
    fields,
    limitApplied,
    readonly: guardStatus === 'passed',
    explain: {
      status: guardStatus === 'passed' ? 'not_run' : 'skipped',
      reason: guardStatus === 'passed'
        ? 'EXPLAIN/cost estimation hook reserved for production query planning.'
        : 'SQL Guard failed before cost estimation.'
    }
  };
}

function fail(
  code: SqlGuardCode,
  message: string,
  originalSql: string,
  audit: SqlGuardAudit,
  details?: Record<string, unknown>
): SqlGuardFailure {
  return {
    guardStatus: 'failed',
    executedSql: false,
    code,
    message,
    originalSql,
    audit: {
      ...audit,
      guardStatus: 'failed',
      code,
      message
    },
    details
  };
}
