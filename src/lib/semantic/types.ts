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
  /** 业务口径定义，用于审计展示和治理。 */
  businessDefinition?: string;
  /** 是否允许从该指标直接下钻到明细行。 */
  allowDetailDrilldown?: boolean;
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
export const timeRangeSchema = z.object({
  type: z.enum(['preset', 'absolute']),
  value: z.string().optional(),
  start: z.string().optional(),
  end: z.string().optional(),
  column: z.string().optional(),
});

export const queryFilterSchema = z.object({
  field: z.string(),
  operator: z.enum(['=', '!=', '>', '<', '>=', '<=', 'in', 'between']),
  value: z.any(),
});

export const queryPlanSchema = z.object({
  intent: z.enum(['metric_query', 'exploration', 'comparison']),
  metrics: z.array(z.object({ id: z.string() })),
  dimensions: z.array(z.object({ id: z.string() })),
  timeRange: timeRangeSchema.optional(),
  comparison: z.object({
    type: z.enum(['YoY', 'MoM', 'PoP']),
  }).optional(),
  filters: z.array(queryFilterSchema),
  orderBy: z.array(z.object({
    field: z.string(),
    direction: z.enum(['asc', 'desc']),
  })).optional(),
  limit: z.number().optional(),
});

export type QueryPlan = z.infer<typeof queryPlanSchema>;
export type QueryFilter = z.infer<typeof queryFilterSchema>;
export type TimeRange = z.infer<typeof timeRangeSchema>;

const analysisWindowSchema = z.object({
  value: z.number().int().positive(),
  unit: z.enum(['day', 'week', 'month']),
});

const analysisGrainSchema = z.enum(['day', 'week', 'month']);

const analysisEntitySchema = z.object({
  id: z.string(),
  column: z.string(),
  label: z.string().optional(),
});

export const analysisEventSchema = z.object({
  id: z.string(),
  name: z.string(),
  entityId: z.string(),
  actorColumn: z.string(),
  timestampColumn: z.string(),
  filters: z.array(queryFilterSchema).optional(),
});

const analysisBaseSchema = z.object({
  intent: z.literal('analysis'),
  entity: analysisEntitySchema,
  timeRange: timeRangeSchema.optional(),
});

export const analysisPlanSchema = z.discriminatedUnion('template', [
  analysisBaseSchema.extend({
    template: z.literal('retention'),
    cohortEvent: analysisEventSchema,
    returnEvent: analysisEventSchema,
    retentionWindow: analysisWindowSchema,
    grain: analysisGrainSchema.optional(),
  }),
  analysisBaseSchema.extend({
    template: z.literal('funnel'),
    steps: z.array(analysisEventSchema).min(2),
    conversionWindow: analysisWindowSchema.optional(),
  }),
  analysisBaseSchema.extend({
    template: z.literal('cohort'),
    cohortEvent: analysisEventSchema,
    grain: analysisGrainSchema.optional(),
  }),
  analysisBaseSchema.extend({
    template: z.literal('path_sequence'),
    events: z.array(analysisEventSchema).min(2),
    limit: z.number().int().positive().optional(),
  }),
]);

export type AnalysisPlan = z.infer<typeof analysisPlanSchema>;
export type AnalysisEvent = z.infer<typeof analysisEventSchema>;

export interface AnalysisAuditEvent {
  id: string;
  name: string;
  entityId: string;
  actorColumn: string;
  timestampColumn: string;
  filters?: QueryFilter[];
}

export interface AnalysisAudit {
  template: AnalysisPlan['template'];
  entity: {
    id: string;
    column: string;
    label?: string;
  };
  timeWindow?: TimeRange;
  parameters: Record<string, string | number | boolean>;
  events: AnalysisAuditEvent[];
}

export interface Lineage {
  path: string[];
  entities: string[];
  metrics: string[];
  dimensions: string[];
  isMultiPass: boolean;
  type: 'SinglePass' | 'MultiPass' | 'Comparison' | 'Analysis';
}

export interface CertificationMetricAudit {
  id: string;
  name: string;
  certified: boolean;
  timeColumn?: string;
  businessDefinition?: string;
  allowDetailDrilldown?: boolean;
}

export interface CertificationDimensionAudit {
  id: string;
  name: string;
  certified: boolean;
}

export interface CertificationRelationshipAudit {
  fromEntityId: string;
  toEntityId: string;
  type: Relationship['type'];
  joinOn: string;
  certified: boolean;
}

export interface CertificationAudit {
  isCertified: boolean;
  certificationLevel: 'certified_plan' | 'semantic_compiled';
  status: 'certified' | 'exploratory';
  reasons: string[];
  metrics: CertificationMetricAudit[];
  dimensions: CertificationDimensionAudit[];
  relationships: CertificationRelationshipAudit[];
}

export interface CompilationResult {
  sql: string;
  lineage: Lineage;
  certification: CertificationAudit;
  analysis?: AnalysisAudit;
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
