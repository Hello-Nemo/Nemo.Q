import { AskMeta, RecoveryAction } from './ask-meta';

export function computeRecoveryActions(args: {
  toolName: string;
  result: any;
}): RecoveryAction[] {
  const { toolName, result } = args;
  const actions: RecoveryAction[] = [];

  // 1. 语义层缺口
  if (result?.code === 'SEMANTIC_COMPILATION_FAILED' || result?.code === 'ANALYSIS_COMPILATION_FAILED') {
    actions.push(
      {
        type: 'use_similar_metric',
        label: '查看相似认证指标',
      },
      {
        type: 'choose_business_definition',
        label: '选择一个替代业务口径',
      },
      {
        type: 'request_certification',
        label: '提交为新的认证口径',
      }
    );
  }

  // 2. 安全拦截
  if (result?.audit?.guardStatus === 'failed' || result?.code?.includes('SQL_GUARD')) {
    actions.push(
      {
        type: 'switch_to_aggregate',
        label: '改用安全汇总结果',
      },
      {
        type: 'retry_safely',
        label: '按安全规则重新生成查询',
      }
    );
  }

  // 3. 计划预览确认
  if (result?.requires_action === true && toolName === 'previewQueryPlan') {
    actions.push(
      {
        type: 'confirm_plan',
        label: '确认并执行',
      },
      {
        type: 'cancel_plan',
        label: '重新调整',
      }
    );
  }

  // 4. 空结果
  if (result?.rows && result.rows.length === 0) {
    actions.push({
      type: 'adjust_filters',
      label: '调整过滤条件或时间范围',
    });
  }

  return actions;
}
