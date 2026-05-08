import { AskMeta, RecoveryAction } from './ask-meta';
import { AnswerPath, TrustLevel } from './ask-state';
import { computeTrustLevel } from './trust-policy';
import { computeRecoveryActions } from './recovery-policy';
import { toUserFacingStatus } from './user-facing-status';
import defaultSemanticLayer from '../semantic-layer.json' with { type: 'json' };
import type { SemanticLayer } from '../semantic/types';
import { generateIntentCandidates } from './intent-candidates';
import { selectDefaultIntentCandidate } from './intent-ranker';

const intentRankingTools = new Set([
  'semanticQuery',
  'analysisQuery',
  'previewQueryPlan',
  'executeQuery',
]);

function getIntentQuestion(args: {
  toolName: string;
  result: any;
  input?: any;
}) {
  if (!intentRankingTools.has(args.toolName)) return '';

  const candidates = [
    args.input?.question,
    args.input?.explanation,
    args.result?.audit?.explanation,
    args.result?.explanation,
  ];

  return candidates.find(candidate => typeof candidate === 'string' && candidate.trim().length > 0)?.trim() || '';
}

function buildIntentRanking(args: {
  toolName: string;
  result: any;
  input?: any;
  trustLevel: TrustLevel;
}) {
  const question = getIntentQuestion(args);
  if (!question) {
    return {};
  }

  try {
    const intentCandidates = generateIntentCandidates({
      question,
      semanticLayer: defaultSemanticLayer as SemanticLayer,
    });
    const defaultIntentCandidate = args.trustLevel === 'blocked'
      ? null
      : selectDefaultIntentCandidate(intentCandidates);

    return {
      intentCandidates,
      ...(defaultIntentCandidate ? { defaultIntentCandidate } : {}),
    };
  } catch {
    return {};
  }
}

function mergeAssumptions(existing: unknown, additions: string[]) {
  const existingAssumptions = Array.isArray(existing)
    ? existing.filter((item): item is string => typeof item === 'string')
    : [];

  return Array.from(new Set([...existingAssumptions, ...additions]));
}

function ensureDefaultIntentAssumptionsVisible(result: any, askMeta: AskMeta) {
  const assumptions = askMeta.defaultIntentCandidate?.assumptions;
  if (!assumptions || assumptions.length === 0 || !result || typeof result !== 'object') {
    return result;
  }

  if (result.audit && typeof result.audit === 'object') {
    return {
      ...result,
      audit: {
        ...result.audit,
        assumptions: mergeAssumptions(result.audit.assumptions, assumptions),
      },
    };
  }

  return {
    ...result,
    assumptions: mergeAssumptions(result.assumptions, assumptions),
  };
}

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
  const intentRanking = buildIntentRanking({ ...args, trustLevel });

  return {
    answerPath,
    trustLevel,
    userFacingStatus,
    recoveryActions,
    ...intentRanking,
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
  // Defensive check for non-object results
  if (!args.result || typeof args.result !== 'object') {
    const askMeta = computeAskMeta(args);
    return {
      output: args.result,
      askMeta,
    };
  }

  const askMeta = computeAskMeta(args);
  const result = ensureDefaultIntentAssumptionsVisible(args.result, askMeta);

  return {
    ...result,
    askMeta,
  };
}
