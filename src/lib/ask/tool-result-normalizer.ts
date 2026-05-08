import { AskMeta, RecoveryAction } from './ask-meta';
import { AnswerPath, TrustLevel } from './ask-state';
import { computeTrustLevel } from './trust-policy';
import { computeRecoveryActions } from './recovery-policy';
import { toUserFacingStatus } from './user-facing-status';

export function computeAnswerPath(args: {
  toolName: string;
  result: any;
}): AnswerPath {
  const { toolName, result } = args;

  if (result?.code === 'SEMANTIC_COMPILATION_FAILED' || result?.code === 'ANALYSIS_COMPILATION_FAILED') {
    return 'semantic_gap';
  }

  if (result?.audit?.guardStatus === 'failed') {
    return 'guard_blocked';
  }

  if (result?.code === 'SQL_AUDIT_PROTOCOL_FAILED') {
    return 'tool_error';
  }

  if (result?.requires_action === true) {
    if (toolName === 'previewQueryPlan') return 'preview_required';
    if (toolName === 'askClarification') return 'clarification_required';
  }

  if (toolName === 'semanticQuery') return 'certified';
  if (toolName === 'analysisQuery') return 'analysis_template';
  if (toolName === 'executeQuery') return 'exploratory';

  return 'unsupported';
}

export function computeAskMeta(args: {
  toolName: string;
  result: any;
  input?: any;
}): AskMeta {
  const { toolName, result } = args;

  const answerPath = computeAnswerPath(args);
  const trustLevel = computeTrustLevel(args);
  const recoveryActions = computeRecoveryActions(args);
  const userFacingStatus = toUserFacingStatus(args);

  return {
    answerPath,
    trustLevel,
    userFacingStatus,
    recoveryActions,
    auditVisibility: {
      showSqlAudit: !!result?.audit,
      showGuardDetails: !!result?.audit?.guard,
      showSemanticCoverage: !!result?.audit?.semanticCoverage,
      defaultExpanded: false,
    },
    internal: {
      rawCode: result?.code,
      rawError: result?.error,
      guardStatus: result?.audit?.guardStatus,
      semanticCoverageStatus: result?.audit?.semanticCoverage?.status,
      certificationLevel: result?.audit?.certificationLevel,
    },
  };
}

export function normalizeToolResult(args: {
  toolName: string;
  result: any;
  input?: any;
}): any {
  const askMeta = computeAskMeta(args);

  return {
    ...args.result,
    askMeta,
  };
}
