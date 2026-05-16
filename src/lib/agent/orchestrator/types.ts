export const RUN_STATUSES = [
  'received',
  'planned',
  'executing',
  'waiting_user',
  'completed',
  'failed',
] as const;

export type AgentRunStatus = (typeof RUN_STATUSES)[number];

export type AgentIntent = 'answer' | 'analyze' | 'execute' | 'research' | 'create' | 'clarify';

export type AgentComplexity = 'simple' | 'multi_step';

export type StepExecutionMode = 'self' | 'skill';

export type AgentPlanStepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'blocked';

export type CapabilityRisk = 'low' | 'medium' | 'high';

export type CapabilityCost = 'low' | 'medium' | 'high';

export interface CapabilityDefinition {
  id: string;
  name: string;
  description: string;
  domains: string[];
  intents: AgentIntent[];
  risk: CapabilityRisk;
  cost: CapabilityCost;
}

export interface AgentPlanStep {
  id: string;
  title: string;
  objective: string;
  requiredCapabilityIds: string[];
  executionMode: StepExecutionMode;
  expectedOutput: string;
  status: AgentPlanStepStatus;
}

export interface AgentPlan {
  goal: string;
  primaryIntent: AgentIntent;
  complexity: AgentComplexity;
  selectedCapabilityIds: string[];
  needsClarification: boolean;
  steps: AgentPlanStep[];
}

export interface AgentObservation {
  stepId: string;
  summary: string;
}

export interface AgentRunState {
  runId: string;
  userGoal: string;
  plan: AgentPlan;
  currentStepId?: string;
  status: AgentRunStatus;
  observations: AgentObservation[];
}

export type AgentTraceEvent =
  | { type: 'run_created'; payload: { state: AgentRunState } }
  | { type: 'plan_created'; payload: { plan: AgentPlan } }
  | { type: 'capability_selected'; payload: { capabilityIds: string[] } }
  | { type: 'step_started'; payload: { stepId: string } }
  | { type: 'step_completed'; payload: { stepId: string } }
  | { type: 'run_completed'; payload: { state: AgentRunState } };
