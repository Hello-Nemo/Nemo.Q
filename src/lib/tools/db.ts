import { tool } from 'ai';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import { PostgresDataSource, IDataSource } from '../db-connector';
import { SQLCompiler } from '../semantic/compiler';
import { QueryPlan, SemanticLayer } from '../semantic/types';


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
  description: '执行生成的 SQL 查询语句并返回结果。仅限 SELECT 语句。',
  inputSchema: z.object({
    explanation: z.string().min(10).describe('用自然语言详细说明取数逻辑。必须包含：关联了哪些表、核心过滤条件是什么、为什么要这样取。严禁使用“查询数据”等占位符。'),
    assumptions: z.array(z.string()).min(1).describe('执行此查询时的业务边界假设。例如：["活跃用户定义为30天内有订单","销售额已剔除已取消订单"]。严禁使用占位符。'),
    sql: z.string().describe('要执行的 PostgreSQL SELECT 语句'),
  }),
  execute: async ({ sql, explanation, assumptions }) => {
    console.log('[DEBUG] executeQuery called with:', { sql, explanation, assumptions });
    
    // 强制执行 SQL_AUDIT_PROTOCOL 校验
    if (!explanation || explanation.length < 10 || !assumptions || assumptions.length === 0) {
      return { 
        error: `违反 SQL_AUDIT_PROTOCOL 强制规范：
1. explanation 必须详细说明取数逻辑（当前长度: ${explanation?.length || 0}，要求至少 10 字）。
2. assumptions 必须包含至少一条业务假设。
请重新生成工具调用，并填充真实的审计证据。严禁使用占位符。` 
      };
    }

    if (!sql.trim().toLowerCase().startsWith('select')) {
      return { error: '出于安全考虑，目前仅支持执行 SELECT 查询。' };
    }

    const ds = getDataSource();
    try {
      const result = await ds.executeQuery(sql);
      return {
        ...result,
        audit: { sql, explanation, assumptions }
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
        diagnosis: e.message
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
    plan: z.object({
      intent: z.enum(['metric_query', 'exploration', 'comparison']),
      metrics: z.array(z.object({ id: z.string() })),
      dimensions: z.array(z.object({ id: z.string() })),
      timeRange: z.object({
        type: z.enum(['preset', 'absolute']),
        value: z.string(),
      }).optional(),
      comparison: z.object({
        type: z.enum(['YoY', 'MoM', 'PoP']),
      }).optional(),
      filters: z.array(z.object({

        field: z.string(),
        operator: z.enum(['=', '!=', '>', '<', '>=', '<=', 'in', 'between']),
        value: z.any(),
      })),
      limit: z.number().optional(),
    }).describe('结构化的查询计划 (Query Plan)'),
  }),
  execute: async ({ plan, explanation }) => {
    const projectName = process.env.CURRENT_PROJECT || 'default';
    const semanticLayer = getSemanticLayer(projectName);
    const compiler = new SQLCompiler(semanticLayer);
    
    try {
      const sql = compiler.compile(plan as QueryPlan);
      console.log('[DEBUG] semanticQuery generated SQL:', sql);
      
      const ds = getDataSource();
      try {
        const result = await ds.executeQuery(sql);
        return {
          ...result,
          audit: { 
            sql, 
            explanation, 
            plan,
            isCertified: true 
          }
        };
      } finally {
        await ds.close();
      }
    } catch (e: any) {
      return { error: `语义查询编译失败: ${e.message}` };
    }
  },
});

export const dbTools = {
  getSchema,
  executeQuery,
  getTableSamples,
  searchTables,
  askClarification,
  semanticQuery,
  listSemanticAtoms,
};


