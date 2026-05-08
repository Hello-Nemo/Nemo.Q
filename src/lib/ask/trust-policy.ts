import { TrustLevel } from './ask-state';

export function computeTrustLevel(args: {
  toolName: string;
  result: any;
}): TrustLevel {
  const { toolName, result } = args;

  // 1. 强制阻断规则
  if (result?.executedSql === false) {
    return 'blocked';
  }

  if (result?.audit?.guardStatus === 'failed') {
    return 'blocked';
  }

  // 2. 需要确认规则
  if (result?.requires_action === true) {
    return 'needs_confirmation';
  }

  // 3. 工具特定规则
  if (toolName === 'semanticQuery') {
    if (result?.audit?.isCertified === true) {
      return 'trusted';
    }
    return 'trusted_with_assumptions';
  }

  if (toolName === 'analysisQuery') {
    if (result?.audit?.certificationLevel === 'certified') {
      return 'trusted_with_assumptions';
    }
    return 'partial';
  }

  if (toolName === 'executeQuery') {
    // executeQuery 永远不能是 trusted
    return 'exploratory';
  }

  if (toolName === 'previewQueryPlan') {
    return 'needs_confirmation';
  }

  if (toolName === 'askClarification') {
    return 'needs_confirmation';
  }

  // 默认兜底
  return 'trusted_with_assumptions';
}
