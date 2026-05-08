import { AskMeta } from './ask-meta';

export function toUserFacingStatus(args: {
  toolName: string;
  result: any;
}): AskMeta['userFacingStatus'] {
  const { toolName, result } = args;

  // 1. 语义编译失败
  if (result?.code === 'SEMANTIC_COMPILATION_FAILED' || result?.code === 'ANALYSIS_COMPILATION_FAILED') {
    return {
      severity: 'warning',
      title: '当前还没有认证口径',
      message: '我没有找到这个问题对应的已认证指标。你可以选择相似指标、临时口径，或提交给管理员认证。',
    };
  }

  // 2. 安全拦截
  if (result?.audit?.guardStatus === 'failed') {
    return {
      severity: 'warning',
      title: '这个查询需要改用安全方式',
      message: '这个问题涉及高风险明细查询。我可以改用安全汇总方式继续分析。',
    };
  }

  // 3. 澄清请求
  if (result?.requires_action === true && toolName === 'askClarification') {
    return {
      severity: 'info',
      title: '需要确认一个业务口径',
      message: '这个问题有多个合理解释，请选择一个最接近你意图的口径。',
    };
  }

  // 4. 预览请求
  if (result?.requires_action === true && toolName === 'previewQueryPlan') {
    return {
      severity: 'info',
      title: '请预览查询计划',
      message: '在执行复杂分析前，请先确认我生成的取数逻辑。',
    };
  }

  // 5. 探索性查询
  if (toolName === 'executeQuery') {
    return {
      severity: 'info',
      title: '探索性结果',
      message: '这个结果来自安全探索查询，不属于已认证业务口径。',
    };
  }

  // 6. 成功兜底
  if (result?.rows) {
    return {
      severity: 'success',
      title: '已生成答案',
      message: '已完成本次分析。',
    };
  }

  return {
    severity: 'info',
    title: '正在处理',
    message: '正在处理您的请求...',
  };
}
