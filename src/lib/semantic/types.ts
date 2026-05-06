/**
 * 语义层核心类型定义
 */
import { z } from 'zod';

export interface Metric {
  id: string;
  name: string;
  expression: string;
  description: string;
  entityId: string;
  /** 指标默认时间字段；用于 preset timeRange 编译。 */
  timeColumn?: string;
  /** 指标是否已经过人工认证。 */
  certified?: boolean;
  formula?: string; // 计算指标公式，如 {{sales_amount}} / {{order_count}}
}

export interface Dimension {
  id: string;
  name: string;
  column: string;
  description: string;
  entityId: string;
  certified?: boolean;
  transform?: string; // 衍生维度转换逻辑，如 CASE WHEN age < 18 THEN 'Minor' ELSE 'Adult' END
}


export interface Entity {
  id: string;
  table: string;
  primaryKey: string;
  description: string;
  type: 'fact' | 'dimension';
  /** 实体默认时间字段；作为 metric.timeColumn 之后的 timeRange 回退。 */
  defaultTimeColumn?: string;
}

export interface Relationship {
  fromEntityId: string;
  toEntityId: string;
  joinOn: string; // e.g., "users.id = orders.user_id"
  type: 'one_to_many' | 'many_to_one' | 'one_to_one' | 'many_to_many';
  /** 路径规划权重。越低越优先；缺省时按关系类型和实体类型推导。 */
  weight?: number;
  /** 关系是否已认证；未认证关系可以参与探索，但不应标记为 certified_plan。 */
  certified?: boolean;
}

export interface SemanticLayer {
  entities: Record<string, Entity>;
  metrics: Record<string, Metric>;
  dimensions: Record<string, Dimension>;
  relationships: Relationship[];
  /** 可选字段字典，用于 getSchema 展示业务描述。 */
  columns?: Record<string, Record<string, string>>;
}

/**
 * Query Plan (IR) 定义
 */
export const queryPlanSchema = z.object({
  intent: z.enum(['metric_query', 'exploration', 'comparison']),
  metrics: z.array(z.object({ id: z.string() })),
  dimensions: z.array(z.object({ id: z.string() })),
  timeRange: z.object({
    type: z.enum(['preset', 'absolute']),
    value: z.string().optional(),
    start: z.string().optional(),
    end: z.string().optional(),
    column: z.string().optional(),
  }).optional(),
  comparison: z.object({
    type: z.enum(['YoY', 'MoM', 'PoP']),
  }).optional(),
  filters: z.array(z.object({
    field: z.string(),
    operator: z.enum(['=', '!=', '>', '<', '>=', '<=', 'in', 'between']),
    value: z.any(),
  })),
  orderBy: z.array(z.object({
    field: z.string(),
    direction: z.enum(['asc', 'desc']),
  })).optional(),
  limit: z.number().optional(),
});

export type QueryPlan = z.infer<typeof queryPlanSchema>;

export interface Lineage {
  path: string[];
  entities: string[];
  metrics: string[];
  dimensions: string[];
  isMultiPass: boolean;
  type: 'SinglePass' | 'MultiPass' | 'Comparison';
}

export interface CompilationResult {
  sql: string;
  lineage: Lineage;
}

export interface CompiledQuery {
  sql: string;
  params: unknown[];
  mode: 'single_pass' | 'multi_pass';
  certificationLevel: 'certified_plan' | 'semantic_compiled';
  explanation: string;
  assumptions: string[];
  lineage: Lineage;
}
