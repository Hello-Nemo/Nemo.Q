import assert from 'node:assert/strict';
import { buildAnalysisQueryAudit } from './db';
import type { AnalysisPlan } from '../semantic/types';

const retentionPlan: AnalysisPlan = {
  intent: 'analysis',
  template: 'retention',
  entity: {
    id: 'users',
    column: 'users.id',
    label: '注册用户'
  },
  cohortEvent: {
    id: 'new_user_signup',
    name: '新用户注册',
    entityId: 'users',
    actorColumn: 'users.id',
    timestampColumn: 'users.joined_at'
  },
  returnEvent: {
    id: 'place_order',
    name: '下单',
    entityId: 'orders',
    actorColumn: 'orders.user_id',
    timestampColumn: 'orders.order_date'
  },
  timeRange: { type: 'preset', value: 'last_30_days' },
  retentionWindow: { value: 7, unit: 'day' },
  grain: 'day'
};

function runTest() {
  const audit = buildAnalysisQueryAudit({
    explanation: '新用户 7 日留存，按注册日 cohort 统计',
    plan: retentionPlan,
    sql: 'WITH cohort AS (...) SELECT cohort_start, retention_rate FROM retention',
    lineage: {
      path: ['users', 'orders'],
      entities: ['users', 'orders'],
      metrics: [],
      dimensions: [],
      isMultiPass: false,
      type: 'Analysis'
    },
    analysis: {
      template: 'retention',
      entity: {
        id: 'users',
        column: 'users.id',
        label: '注册用户'
      },
      timeWindow: { type: 'preset', value: 'last_30_days' },
      parameters: {
        retentionWindow: '7 days',
        grain: 'day'
      },
      events: [
        {
          id: 'new_user_signup',
          name: '新用户注册',
          entityId: 'users',
          actorColumn: 'users.id',
          timestampColumn: 'users.joined_at'
        },
        {
          id: 'place_order',
          name: '下单',
          entityId: 'orders',
          actorColumn: 'orders.user_id',
          timestampColumn: 'orders.order_date'
        }
      ]
    },
    certification: {
      isCertified: true,
      certificationLevel: 'certified_plan',
      status: 'certified',
      reasons: [],
      metrics: [],
      dimensions: [],
      relationships: [
        {
          fromEntityId: 'users',
          toEntityId: 'orders',
          type: 'one_to_many',
          joinOn: 'users.id = orders.user_id',
          certified: true
        }
      ]
    }
  });

  assert.equal(audit.plan.intent, 'analysis');
  assert.equal(audit.analysis.template, 'retention');
  assert.equal(audit.analysis.parameters.retentionWindow, '7 days');
  assert.equal(audit.analysis.events[0].name, '新用户注册');
  assert.equal(audit.isCertified, true);
  assert.equal(audit.certificationLevel, 'certified_plan');
  assert.match(audit.sql, /WITH cohort/);

  console.log('analysis query audit tests passed.');
}

runTest();
