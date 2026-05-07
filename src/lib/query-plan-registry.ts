import { createHash, randomBytes } from 'node:crypto';
import { Lineage, QueryPlan } from './semantic/types';

export type QueryPlanRecordStatus = 'previewed' | 'executed' | 'canceled';
export type QueryPlanAuditStage = 'preview' | 'confirm' | 'execute' | 'cancel' | 'reject';

export interface QueryPlanAuditEvent {
  stage: QueryPlanAuditStage;
  at: string;
  planHash?: string;
  sqlHash?: string;
  feedback?: string;
  reason?: string;
}

export interface QueryPlanPreviewRecord {
  planId: string;
  projectName: string;
  explanation: string;
  plan: QueryPlan;
  sql: string;
  lineage: Lineage;
  planHash: string;
  sqlHash: string;
  status: QueryPlanRecordStatus;
  createdAt: string;
  updatedAt: string;
  events: QueryPlanAuditEvent[];
}

type QueryPlanRegistryGlobal = typeof globalThis & {
  __nemoQueryPlanRegistry?: Map<string, QueryPlanPreviewRecord>;
};

const registryGlobal = globalThis as QueryPlanRegistryGlobal;
const registry = registryGlobal.__nemoQueryPlanRegistry ?? new Map<string, QueryPlanPreviewRecord>();
registryGlobal.__nemoQueryPlanRegistry = registry;

function stableNormalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stableNormalize);
  }

  if (value && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = stableNormalize((value as Record<string, unknown>)[key]);
        return acc;
      }, {});
  }

  return value;
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(stableNormalize(value));
}

export function hashPayload(value: unknown): string {
  return createHash('sha256').update(stableStringify(value)).digest('hex');
}

export function hashPlan(plan: QueryPlan): string {
  return hashPayload(plan);
}

export function normalizeSql(sql: string): string {
  return sql.trim().replace(/\s+/g, ' ');
}

export function hashSql(sql: string): string {
  return hashPayload(normalizeSql(sql));
}

export function createPlanId(): string {
  return `plan_${Date.now().toString(36)}_${randomBytes(8).toString('hex')}`;
}

export function registerPreviewedQueryPlan(args: {
  projectName: string;
  explanation: string;
  plan: QueryPlan;
  sql: string;
  lineage: Lineage;
}): QueryPlanPreviewRecord {
  const now = new Date().toISOString();
  const planHash = hashPlan(args.plan);
  const sqlHash = hashSql(args.sql);
  const record: QueryPlanPreviewRecord = {
    planId: createPlanId(),
    projectName: args.projectName,
    explanation: args.explanation,
    plan: args.plan,
    sql: args.sql,
    lineage: args.lineage,
    planHash,
    sqlHash,
    status: 'previewed',
    createdAt: now,
    updatedAt: now,
    events: [{ stage: 'preview', at: now, planHash, sqlHash }],
  };

  registry.set(record.planId, record);
  return record;
}

export function getPreviewedQueryPlan(planId: string): QueryPlanPreviewRecord | undefined {
  return registry.get(planId);
}

export function appendQueryPlanEvent(
  planId: string,
  event: QueryPlanAuditEvent,
  status?: QueryPlanRecordStatus
): QueryPlanPreviewRecord | undefined {
  const record = registry.get(planId);
  if (!record) return undefined;

  const nextRecord: QueryPlanPreviewRecord = {
    ...record,
    status: status ?? record.status,
    updatedAt: event.at,
    events: [...record.events, event],
  };

  registry.set(planId, nextRecord);
  return nextRecord;
}
