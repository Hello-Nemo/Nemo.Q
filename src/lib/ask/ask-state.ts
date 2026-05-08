export type AnswerPath =
  | 'certified'
  | 'analysis_template'
  | 'exploratory'
  | 'preview_required'
  | 'clarification_required'
  | 'semantic_gap'
  | 'permission_blocked'
  | 'guard_blocked'
  | 'tool_error'
  | 'unsupported';

export type TrustLevel =
  | 'trusted'
  | 'trusted_with_assumptions'
  | 'partial'
  | 'exploratory'
  | 'needs_confirmation'
  | 'blocked';
