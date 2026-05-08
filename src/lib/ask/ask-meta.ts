import { AnswerPath, TrustLevel } from './ask-state';
import type { IntentCandidate } from './intent-candidates';

export type RecoveryAction = {
  type:
    | 'use_certified_metric'
    | 'use_similar_metric'
    | 'use_temporary_metric'
    | 'request_certification'
    | 'switch_to_aggregate'
    | 'request_permission'
    | 'choose_business_definition'
    | 'retry_safely'
    | 'adjust_filters'
    | 'confirm_plan'
    | 'cancel_plan';
  label: string;
  description?: string;
};

export type AskMeta = {
  answerPath: AnswerPath;
  trustLevel: TrustLevel;

  userFacingStatus: {
    title: string;
    message: string;
    severity: 'info' | 'success' | 'warning' | 'error';
  };

  recoveryActions: RecoveryAction[];

  intentCandidates?: IntentCandidate[];
  defaultIntentCandidate?: IntentCandidate;

  auditVisibility: {
    showSqlAudit: boolean;
    showGuardDetails: boolean;
    showSemanticCoverage: boolean;
    defaultExpanded: boolean;
  };

  internal?: {
    rawCode?: string;
    rawError?: string;
    guardStatus?: string;
    semanticCoverageStatus?: string;
    certificationLevel?: string;
  };
};
