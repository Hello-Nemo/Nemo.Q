/**
 * 语义层核心类型定义
 */

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
export interface QueryPlan {
  intent: 'metric_query' | 'exploration' | 'comparison';
  metrics: Array<{ id: string }>;
  dimensions: Array<{ id: string }>;
  timeRange?: {
    type: 'preset' | 'absolute';
    value?: string;
    start?: string;
    end?: string;
    column?: string;
  };
  comparison?: {
    type: 'YoY' | 'MoM' | 'PoP';
  };
  filters: Array<{
    field: string;
    operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'in' | 'between';
    value: unknown;
  }>;
  orderBy?: Array<{
    field: string;
    direction: 'asc' | 'desc';
  }>;
  limit?: number;
}

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

