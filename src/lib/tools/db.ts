import { tool } from 'ai';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import { PostgresDataSource, IDataSource } from '../db-connector';
import { SQLCompiler } from '../semantic/compiler';
import {
  AnalysisAudit,
  AnalysisPlan,
  analysisPlanSchema,
  CertificationAudit,
  Lineage,
  QueryPlan,
  SemanticLayer,
  queryPlanSchema
} from '../semantic/types';
import { detectSemanticCoverage } from '../semantic/coverage';
import { buildSqlGuardPolicy, guardSql } from '../sql-guard/guard';
import {
  appendQueryPlanEvent,
  getPreviewedQueryPlan,
  hashPlan,
  hashSql,
  registerPreviewedQueryPlan,
  QueryPlanAuditEvent,
} from '../query-plan-registry';


// 加载语义层配置
const getSemanticLayer = (projectName: string = 'default'): SemanticLayer => {
  try {
    const projectPath = path.join(process.cwd(), `src/lib/semantic/${projectName}.json`);
    const rootPath = path.join(process.cwd(), 'src/lib/semantic-layer.json');
    const targetPath = fs.existsSync(projectPath) ? projectPath : rootPath;
    
    if (fs.existsSync(targetPath)) {
      return JSON.parse(fs.readFileSync(targetPath, 'utf8'));
    }
  } catch (e) {
    console.error('无法加载语义层定义:', e);
  }
  return { entities: {}, metrics: {}, dimensions: {}, relationships: [] };
};


// 数据源工厂 (未来可支持 MySQL 等)
const getDataSource = (): IDataSource => {
  const projectName = process.env.CURRENT_PROJECT || 'default';
  const semanticLayer = getSemanticLayer(projectName);
  const dbUrl = process.env.DATABASE_URL || '';
  return new PostgresDataSource(dbUrl, semanticLayer);
};

const buildSemanticCompilationError = (message: string) => ({
  error: `语义查询编译失败: ${message}`,
  code: 'SEMANTIC_COMPILATION_FAILED',
  reason: 'SEMANTIC_ATOM_NOT_FOUND',
  executedSql: false,
  hint: '请调用 listSemanticAtoms 查看当前可用的指标和维度；如果用户所需口径不在语义层中，请调用 askClarification 让用户选择替代口径或说明语义层未覆盖。',
  recoveryActions: ['listSemanticAtoms', 'askClarification'],
  details: { message }
});

const nowIso = () => new Date().toISOString();

const buildApprovalChain = (events: QueryPlanAuditEvent[]) =>
  events.map(event => ({
    ...event,
    label: {
      preview: 'preview plan',
      confirm: 'confirm plan',
      execute: 'execute sql',
      cancel: 'cancel plan',
      reject: 'reject execution',
    }[event.stage],
  }));

const buildMismatchResult = (args: {
  planId: string;
  reason: string;
  preview?: {
    planHash?: string;
    sqlHash?: string;
    sql?: string;
  };
  attempted?: {
    planHash?: string;
    sqlHash?: string;
    sql?: string;
  };
  events: QueryPlanAuditEvent[];
}) => ({
  error: `预览计划与确认计划不一致，已拒绝执行。${args.reason}`,
  code: 'PREVIEW_EXECUTION_MISMATCH',
  executedSql: false,
  audit: {
    planId: args.planId,
    preview: args.preview,
    attempted: args.attempted,
    approvalChain: buildApprovalChain(args.events),
  },
});

const buildSemanticQueryAudit = (args: {
  sql: string;
  explanation: string;
  plan: QueryPlan;
  lineage: Lineage;
  certification: CertificationAudit;
}) => ({
  sql: args.sql,
  explanation: args.explanation,
  plan: {
    ...args.plan,
    certificationLevel: args.certification.certificationLevel,
  },
  lineage: args.lineage,
  isCertified: args.certification.isCertified,
  certificationLevel: args.certification.certificationLevel,
  certification: args.certification,
});

export const buildAnalysisQueryAudit = (args: {
  sql: string;
  explanation: string;
  plan: AnalysisPlan;
  lineage: Lineage;
  analysis: AnalysisAudit;
  certification: CertificationAudit;
}) => ({
  sql: args.sql,
  explanation: args.explanation,
  plan: {
    ...args.plan,
    certificationLevel: args.certification.certificationLevel,
  },
  lineage: args.lineage,
  analysis: args.analysis,
  isCertified: args.certification.isCertified,
  certificationLevel: args.certification.certificationLevel,
  certification: args.certification,
});

/**
 * 获取数据库所有表的元数据
 */
export const getSchema = tool({
  description: '获取数据库中所有表的名称及字段信息，用于了解数据库结构。',
  inputSchema: z.object({
    schema: z.string().default('public'),
  }),
  execute: async ({ schema }) => {
    const ds = getDataSource();
    try {
      return await ds.getSchema(schema);
    } finally {
      await ds.close();
    }
  },
});

/**
 * 执行 SQL 查询
 */
export const executeQuery = tool({
  description: '执行生成的探索性 SQL 查询语句并返回结果。仅限通过 SQL Guard 的 SELECT 或 WITH ... SELECT 查询。',
  inputSchema: z.object({
    question: z.string().optional().describe('用户原始问题。用于在执行前判断是否命中语义层认证指标；如果是标准指标查询，应改用 semanticQuery。'),
    explanation: z.string().min(10).describe('用自然语言详细说明取数逻辑。必须包含：关联了哪些表、核心过滤条件是什么、为什么要这样取。严禁使用“查询数据”等占位符。'),
    assumptions: z.array(z.string()).min(1).describe('执行此查询时的业务边界假设。例如：["活跃用户定义为30天内有订单","销售额已剔除已取消订单"]。严禁使用占位符。'),
    sql: z.string().describe('要执行的 PostgreSQL SELECT 语句'),
  }),
  execute: async ({ sql, explanation, assumptions, question }) => {
    console.log('[DEBUG] executeQuery called with:', { sql, explanation, assumptions, question });
    
    // 强制执行 SQL_AUDIT_PROTOCOL 校验
    if (!explanation || explanation.length < 10 || !assumptions || assumptions.length === 0) {
      return { 
        error: `违反 SQL_AUDIT_PROTOCOL 强制规范：
1. explanation 必须详细说明取数逻辑（当前长度: ${explanation?.length || 0}，要求至少 10 字）。
2. assumptions 必须包含至少一条业务假设。
请重新生成工具调用，并填充真实的审计证据。严禁使用占位符。`,
        code: 'SQL_AUDIT_PROTOCOL_FAILED',
        executedSql: false,
        audit: {
          sql,
          explanation,
          assumptions,
          guardStatus: 'failed'
        }
      };
    }

    const projectName = process.env.CURRENT_PROJECT || 'default';
    const semanticLayer = getSemanticLayer(projectName);
    const guardResult = guardSql(sql, buildSqlGuardPolicy(semanticLayer));

    if (guardResult.guardStatus === 'failed') {
      return {
        error: guardResult.message,
        code: guardResult.code,
        executedSql: false,
        hint: 'SQL Guard 已阻止执行。请改写为单条、只读、显式字段、且仅引用语义层授权表字段的 SELECT 查询。',
        details: guardResult.details,
        audit: {
          sql,
          explanation,
          assumptions,
          guardStatus: guardResult.guardStatus,
          guard: guardResult.audit
        }
      };
    }

    const semanticCoverage = detectSemanticCoverage({
      sql: guardResult.sql,
      semanticLayer,
      question,
      explanation,
      assumptions,
      fields: guardResult.audit.fields
    });

    if (semanticCoverage.coverageStatus === 'failed') {
      return {
        error: semanticCoverage.error,
        code: semanticCoverage.code,
        executedSql: false,
        hint: semanticCoverage.hint,
        recoveryActions: semanticCoverage.recoveryActions,
        details: semanticCoverage.details,
        audit: {
          sql: guardResult.sql,
          originalSql: guardResult.originalSql,
          question,
          explanation,
          assumptions,
          guardStatus: guardResult.guardStatus,
          guard: guardResult.audit,
          semanticCoverage: semanticCoverage.audit
        }
      };
    }

    const ds = getDataSource();
    try {
      const result = await ds.executeQuery(guardResult.sql);
      return {
        ...result,
        audit: {
          sql: guardResult.sql,
          originalSql: guardResult.originalSql,
          question,
          explanation,
          assumptions,
          guardStatus: guardResult.guardStatus,
          guard: guardResult.audit,
          semanticCoverage: semanticCoverage.audit,
          isCertified: false
        }
      };
    } catch (e: any) {
      console.error('[ERROR] executeQuery failed:', e);
      // 返回结构化的诊断信息，触发 Agent 的 SELF_HEALING_PROTOCOL
      return {
        error: `SQL 执行失败: ${e.message}`,
        hint: `请检查以下可能的原因：
1. 字段名或表名拼写错误（建议再次调用 getSchema 确认）。
2. SQL 语法错误（如缺少 JOIN 条件或 GROUP BY 字段）。
3. 业务逻辑冲突（如使用了不存在的过滤值）。
请根据报错信息修正后重试。`,
        diagnosis: e.message,
        audit: {
          sql: guardResult.sql,
          originalSql: guardResult.originalSql,
          question,
          explanation,
          assumptions,
          guardStatus: guardResult.guardStatus,
          guard: guardResult.audit,
          semanticCoverage: semanticCoverage.audit,
          isCertified: false
        }
      };
    } finally {
      await ds.close();
    }
  },
});

/**
 * 获取特定表的随机样本数据（仅限 5 条）
 */
export const getTableSamples = tool({
  description: '获取特定表的几条随机样本数据，用于观察真实的数据格式和枚举值。',
  inputSchema: z.object({
    tableName: z.string().describe('要采样的表名'),
  }),
  execute: async ({ tableName }) => {
    const ds = getDataSource();
    try {
      return await ds.getTableSamples(tableName);
    } finally {
      await ds.close();
    }
  },
});

/**
 * 搜索特定表（大数据量场景下的裁剪工具）
 */
export const searchTables = tool({
  description: '在大规模数据库中，通过关键字搜索相关的表名。当 getSchema 返回的表过多或不包含所需信息时使用。',
  inputSchema: z.object({
    keyword: z.string().describe('搜索关键词（如 "order", "user"）'),
  }),
  execute: async ({ keyword }) => {
    const ds = getDataSource();
    try {
      const allSchema = await ds.getSchema();
      const filtered: Record<string, any> = {};
      Object.entries(allSchema.tables).forEach(([name, meta]) => {
        if (name.includes(keyword) || JSON.stringify(meta).includes(keyword)) {
          filtered[name] = meta;
        }
      });
      return { tables: filtered };
    } finally {
      await ds.close();
    }
  },
});

/**
 * 检索语义资产 (指标、维度、实体)
 */
export const listSemanticAtoms = tool({
  description: '查询语义层中可用的标准指标、维度和实体定义。当不确定业务字段名称或口径时使用。支持分页。',
  inputSchema: z.object({
    type: z.enum(['metrics', 'dimensions', 'entities', 'all']).default('all'),
    keyword: z.string().optional().describe('搜索关键词'),
    limit: z.number().default(20),
    offset: z.number().default(0),
  }),
  execute: async ({ type, keyword, limit, offset }) => {
    const layer = getSemanticLayer();
    const result: any = {};

    if (type === 'metrics' || type === 'all') {
      result.metrics = Object.values(layer.metrics)
        .filter(m => !keyword || m.name.includes(keyword) || m.id.includes(keyword) || m.description.includes(keyword))
        .slice(offset, offset + limit);
    }
    if (type === 'dimensions' || type === 'all') {
      result.dimensions = Object.values(layer.dimensions)
        .filter(d => !keyword || d.name.includes(keyword) || d.id.includes(keyword) || d.description.includes(keyword))
        .slice(offset, offset + limit);
    }
    if (type === 'entities' || type === 'all') {
      result.entities = Object.values(layer.entities)
        .filter(e => !keyword || e.table.includes(keyword) || e.id.includes(keyword) || e.description.includes(keyword))
        .slice(offset, offset + limit);
    }

    return result;
  },
});

export const askClarification = tool({

  description: '当用户的需求存在业务歧义、口径不明确或需要补充信息时调用。该工具会暂停当前任务并向用户寻求澄清。',
  inputSchema: z.object({
    question: z.string().describe('需要用户澄清的具体问题'),
    options: z.array(z.object({
      label: z.string().describe('选项显示的文本（如："按日环比"）'),
      value: z.string().describe('选中该选项后代表的业务定义（如："daily_growth"）'),
      description: z.string().optional().describe('选项的详细说明'),
    })).describe('预设的结构化备选选项，方便用户直接点击'),
    context: z.string().optional().describe('产生歧义的业务背景或逻辑冲突描述'),
  }),
  execute: async (args) => {
    // 在 UI 侧，这会被标记为 requires_action，暂停 Agent 循环等待用户输入
    return { ...args, requires_action: true };
  },
});

/**
 * 语义化查询：通过 Query Plan 进行标准指标查询
 */
export const semanticQuery = tool({
  description: '通过语义层进行标准指标查询。这是最推荐的取数方式，能够保证 100% 准确性。',
  inputSchema: z.object({
    explanation: z.string().describe('用自然语言说明本次查询的业务意图。'),
    plan: queryPlanSchema.describe('结构化的查询计划 (Query Plan)'),
  }),
  execute: async ({ plan, explanation }) => {
    const projectName = process.env.CURRENT_PROJECT || 'default';
    const semanticLayer = getSemanticLayer(projectName);
    const compiler = new SQLCompiler(semanticLayer);
    
    try {
      const compilationResult = compiler.compile(plan as QueryPlan);
      const { sql, lineage, certification } = compilationResult;
      console.log('[DEBUG] semanticQuery generated SQL:', sql);
      
      const ds = getDataSource();
      try {
        const result = await ds.executeQuery(sql);
        return {
          ...result,
          audit: buildSemanticQueryAudit({
            sql,
            explanation,
            plan: plan as QueryPlan,
            lineage,
            certification,
          })
        };
      } finally {
        await ds.close();
      }
    } catch (e: any) {
      return buildSemanticCompilationError(e.message);
    }
  },
});

/**
 * 分析模板查询：通过 AnalysisPlan 编译复杂分析，避免让 LLM 直接手写治理外 SQL。
 */
export const analysisQuery = tool({
  description: '通过 AnalysisPlan 分析模板执行复杂分析，支持 retention、funnel、cohort、path_sequence。适用于留存、漏斗、cohort 和路径序列等无法表达为普通指标查询的问题。',
  inputSchema: z.object({
    explanation: z.string().describe('用自然语言说明本次分析的业务意图与模板口径。'),
    plan: analysisPlanSchema.describe('结构化的分析计划 (AnalysisPlan)'),
  }),
  execute: async ({ plan, explanation }) => {
    const projectName = process.env.CURRENT_PROJECT || 'default';
    const semanticLayer = getSemanticLayer(projectName);
    const compiler = new SQLCompiler(semanticLayer);

    try {
      const compilationResult = compiler.compileAnalysis(plan as AnalysisPlan);
      const { sql, lineage, certification, analysis } = compilationResult;
      console.log('[DEBUG] analysisQuery generated SQL:', sql);

      const ds = getDataSource();
      try {
        const result = await ds.executeQuery(sql);
        return {
          ...result,
          audit: buildAnalysisQueryAudit({
            sql,
            explanation,
            plan: plan as AnalysisPlan,
            lineage,
            analysis: analysis!,
            certification,
          })
        };
      } finally {
        await ds.close();
      }
    } catch (e: any) {
      return {
        ...buildSemanticCompilationError(e.message),
        error: `分析查询编译失败: ${e.message}`,
        code: 'ANALYSIS_COMPILATION_FAILED',
        hint: '请检查 AnalysisPlan 的 template、事件定义、时间窗口和实体口径；如果该探索无法模板化，允许改用 executeQuery 并提供完整 SQL_AUDIT_PROTOCOL 审计证据。',
        recoveryActions: ['analysisQuery', 'executeQuery'],
      };
    }
  },
});

export async function confirmPreviewedQueryPlan(args: {
  planId: string;
  plan?: QueryPlan;
  explanation?: string;
  previewPlanHash?: string;
  previewSqlHash?: string;
  executeSql?: (sql: string) => Promise<any>;
}) {
  const projectName = process.env.CURRENT_PROJECT || 'default';
  const record = getPreviewedQueryPlan(args.planId);
  const plan = record?.plan || args.plan;
  const confirmedAt = nowIso();
  const confirmEvent: QueryPlanAuditEvent = {
    stage: 'confirm',
    at: confirmedAt,
  };

  if (!plan) {
    const rejectEvent: QueryPlanAuditEvent = {
      stage: 'reject',
      at: nowIso(),
      reason: 'planId 未在服务端登记，且确认请求没有携带结构化 plan。',
    };

    return {
      error: '确认失败：该预览计划不存在或已丢失，请重新生成预览。',
      code: 'QUERY_PLAN_NOT_FOUND',
      executedSql: false,
      audit: {
        planId: args.planId,
        approvalChain: buildApprovalChain([confirmEvent, rejectEvent]),
      },
    };
  }

  const attemptedPlanHash = hashPlan(plan);
  const expectedPlanHash = record?.planHash || args.previewPlanHash || attemptedPlanHash;

  if (args.plan && record && hashPlan(args.plan) !== record.planHash) {
    const rejectEvent: QueryPlanAuditEvent = {
      stage: 'reject',
      at: nowIso(),
      reason: '确认请求携带的 plan 与服务端预览记录不一致。',
    };
    appendQueryPlanEvent(args.planId, rejectEvent);

    return buildMismatchResult({
      planId: args.planId,
      reason: '确认请求携带的 plan 与服务端预览记录不一致。',
      preview: {
        planHash: record.planHash,
        sqlHash: record.sqlHash,
        sql: record.sql,
      },
      attempted: {
        planHash: hashPlan(args.plan),
      },
      events: [...record.events, confirmEvent, rejectEvent],
    });
  }

  if (args.previewPlanHash && args.previewPlanHash !== expectedPlanHash) {
    const rejectEvent: QueryPlanAuditEvent = {
      stage: 'reject',
      at: nowIso(),
      reason: '确认请求携带的 previewPlanHash 与登记记录不一致。',
    };
    if (record) appendQueryPlanEvent(args.planId, rejectEvent);

    return buildMismatchResult({
      planId: args.planId,
      reason: '确认请求携带的 previewPlanHash 与登记记录不一致。',
      preview: {
        planHash: expectedPlanHash,
        sqlHash: record?.sqlHash || args.previewSqlHash,
        sql: record?.sql,
      },
      attempted: {
        planHash: args.previewPlanHash,
      },
      events: [...(record?.events || []), confirmEvent, rejectEvent],
    });
  }

  const semanticLayer = getSemanticLayer(projectName);
  const compiler = new SQLCompiler(semanticLayer);

  try {
    const compilationResult = compiler.compile(plan as QueryPlan);
    const { sql, lineage, certification } = compilationResult;
    const attemptedSqlHash = hashSql(sql);
    const expectedSqlHash = record?.sqlHash || args.previewSqlHash || attemptedSqlHash;

    if (attemptedPlanHash !== expectedPlanHash || attemptedSqlHash !== expectedSqlHash) {
      const rejectEvent: QueryPlanAuditEvent = {
        stage: 'reject',
        at: nowIso(),
        planHash: attemptedPlanHash,
        sqlHash: attemptedSqlHash,
        reason: '重新编译后的 plan 或 SQL hash 与预览不一致。',
      };
      if (record) appendQueryPlanEvent(args.planId, rejectEvent);

      return buildMismatchResult({
        planId: args.planId,
        reason: '重新编译后的 plan 或 SQL hash 与预览不一致。',
        preview: {
          planHash: expectedPlanHash,
          sqlHash: expectedSqlHash,
          sql: record?.sql,
        },
        attempted: {
          planHash: attemptedPlanHash,
          sqlHash: attemptedSqlHash,
          sql,
        },
        events: [...(record?.events || []), confirmEvent, rejectEvent],
      });
    }

    const execute = args.executeSql ?? (async (compiledSql: string) => {
      const ds = getDataSource();
      try {
        return await ds.executeQuery(compiledSql);
      } finally {
        await ds.close();
      }
    });

    if (record) appendQueryPlanEvent(args.planId, confirmEvent);

    const result = await execute(sql);
    const executedAt = nowIso();
    const executeEvent: QueryPlanAuditEvent = {
      stage: 'execute',
      at: executedAt,
      planHash: attemptedPlanHash,
      sqlHash: attemptedSqlHash,
    };
    const latestRecord = record
      ? appendQueryPlanEvent(args.planId, executeEvent, 'executed')
      : undefined;
    const previewEvent: QueryPlanAuditEvent = record
      ? record.events[0]
      : {
          stage: 'preview',
          at: confirmedAt,
          planHash: expectedPlanHash,
          sqlHash: expectedSqlHash,
        };

    return {
      ...result,
      audit: {
        ...buildSemanticQueryAudit({
          sql,
          explanation: record?.explanation || args.explanation || '确认执行已预览查询计划',
          plan: plan as QueryPlan,
          lineage,
          certification,
        }),
        planId: args.planId,
        preview: {
          planHash: expectedPlanHash,
          sqlHash: expectedSqlHash,
          sql: record?.sql || sql,
          at: record?.createdAt || previewEvent.at,
          source: record ? 'server-session' : 'message-metadata',
        },
        confirmed: {
          at: confirmedAt,
          source: record ? 'server-session' : 'message-metadata',
        },
        executed: {
          planHash: attemptedPlanHash,
          sqlHash: attemptedSqlHash,
          sql,
          at: executedAt,
        },
        approvalChain: buildApprovalChain(
          latestRecord?.events || [previewEvent, confirmEvent, executeEvent]
        ),
      },
    };
  } catch (e: any) {
    return buildSemanticCompilationError(e.message);
  }
}

export function cancelPreviewedQueryPlan(args: {
  planId: string;
  feedback?: string;
  plan?: QueryPlan;
  previewPlanHash?: string;
}) {
  const record = getPreviewedQueryPlan(args.planId);
  const canceledAt = nowIso();
  const planHash = record?.planHash || (args.plan ? hashPlan(args.plan) : args.previewPlanHash);
  const cancelEvent: QueryPlanAuditEvent = {
    stage: 'cancel',
    at: canceledAt,
    planHash,
    feedback: args.feedback,
  };
  const latestRecord = appendQueryPlanEvent(args.planId, cancelEvent, 'canceled');

  return {
    canceled: true,
    requires_action: false,
    planId: args.planId,
    feedback: args.feedback,
    audit: {
      planId: args.planId,
      preview: record
        ? {
            planHash: record.planHash,
            sqlHash: record.sqlHash,
            sql: record.sql,
            at: record.createdAt,
          }
        : {
            planHash,
            source: 'message-metadata',
          },
      approvalChain: buildApprovalChain(latestRecord?.events || [cancelEvent]),
    },
  };
}

export function createPreviewedQueryPlan(args: {
  plan: QueryPlan;
  explanation: string;
  projectName?: string;
}) {
  const projectName = args.projectName || process.env.CURRENT_PROJECT || 'default';
  const semanticLayer = getSemanticLayer(projectName);
  const compiler = new SQLCompiler(semanticLayer);
  const result = compiler.compile(args.plan as QueryPlan);
  const record = registerPreviewedQueryPlan({
    projectName,
    explanation: args.explanation,
    plan: args.plan as QueryPlan,
    sql: result.sql,
    lineage: result.lineage,
  });

  return {
    ...result,
    plan: args.plan,
    planId: record.planId,
    planHash: record.planHash,
    previewSqlHash: record.sqlHash,
    audit: {
      ...buildSemanticQueryAudit({
        sql: result.sql,
        explanation: args.explanation,
        plan: args.plan as QueryPlan,
        lineage: result.lineage,
        certification: result.certification,
      }),
      planId: record.planId,
      preview: {
        planHash: record.planHash,
        sqlHash: record.sqlHash,
        sql: result.sql,
        at: record.createdAt,
      },
      approvalChain: buildApprovalChain(record.events),
    },
    explanation: args.explanation,
    requires_action: true,
    preview: true,
  };
}

/**
 * 预览查询计划：仅编译不执行，用于用户确认逻辑
 */
export const previewQueryPlan = tool({
  description: '在执行复杂查询前预览生成的逻辑路径和 SQL 结构。适用于多表关联或对比分析场景。',
  inputSchema: z.object({
    explanation: z.string().describe('用自然语言说明本次查询的业务意图。'),
    plan: queryPlanSchema.describe('结构化的查询计划 (QueryPlan)'),
  }),
  execute: async ({ plan, explanation }) => {
    try {
      return createPreviewedQueryPlan({
        explanation,
        plan: plan as QueryPlan,
      });
    } catch (e: any) {
      return {
        ...buildSemanticCompilationError(e.message),
        error: `计划生成失败: ${e.message}`,
      };
    }
  },
});

export const confirmQueryPlan = tool({
  description: '根据 previewQueryPlan 返回的 planId 或结构化 plan 确认执行已预览的语义查询计划。必须校验 preview 与 execute 的 plan/sql hash 一致。',
  inputSchema: z.object({
    planId: z.string().describe('previewQueryPlan 返回的计划 ID'),
    plan: queryPlanSchema.optional().describe('可选的完整 QueryPlan；当服务端 session 丢失时作为 message metadata 回退'),
    previewPlanHash: z.string().optional().describe('previewQueryPlan 返回的 planHash'),
    previewSqlHash: z.string().optional().describe('previewQueryPlan 返回的 previewSqlHash'),
  }),
  execute: async ({ planId, plan, previewPlanHash, previewSqlHash }) =>
    confirmPreviewedQueryPlan({ planId, plan, previewPlanHash, previewSqlHash }),
});

export const cancelQueryPlan = tool({
  description: '取消已预览但尚未执行的 QueryPlan，并记录 planId 与用户反馈。',
  inputSchema: z.object({
    planId: z.string().describe('previewQueryPlan 返回的计划 ID'),
    feedback: z.string().optional().describe('用户取消或要求调整的原因'),
    plan: queryPlanSchema.optional().describe('可选的完整 QueryPlan，用于 session 丢失时保留审计上下文'),
    previewPlanHash: z.string().optional().describe('previewQueryPlan 返回的 planHash'),
  }),
  execute: async ({ planId, feedback, plan, previewPlanHash }) =>
    cancelPreviewedQueryPlan({ planId, feedback, plan, previewPlanHash }),
});

export const dbTools = {
  getSchema,
  executeQuery,
  getTableSamples,
  searchTables,
  askClarification,
  semanticQuery,
  analysisQuery,
  previewQueryPlan,
  confirmQueryPlan,
  cancelQueryPlan,
  listSemanticAtoms,
};
