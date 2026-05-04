/**
 * 语义层核心类型定义
 */

export interface Metric {
  id: string;
  name: string;
  expression: string;
  description: string;
  entityId: string;
}

export interface Dimension {
  id: string;
  name: string;
  column: string;
  description: string;
  entityId: string;
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
  type: 'one_to_many' | 'many_to_one' | 'one_to_one';
}

export interface SemanticLayer {
  entities: Record<string, Entity>;
  metrics: Record<string, Metric>;
  dimensions: Record<string, Dimension>;
  relationships: Relationship[];
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
    value: string;
    column?: string;
  };
  filters: Array<{
    field: string;
    operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'in' | 'between';
    value: any;
  }>;
  orderBy?: Array<{
    field: string;
    direction: 'asc' | 'desc';
  }>;
  limit?: number;
}
