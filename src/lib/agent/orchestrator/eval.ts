import type { AgentIntent, AgentPlan } from './types';

export type AgentEvalCase = {
  id: string;
  request: string;
  expectedIntent: AgentIntent;
  expectedCapabilityIds: string[];
  needsClarification: boolean;
  minSteps: number;
  maxSteps: number;
};

export type AgentEvalResult = {
  passed: boolean;
  failures: string[];
};

const formatCapabilities = (capabilityIds: string[]) => (
  capabilityIds.length > 0 ? capabilityIds.join(', ') : 'none'
);

export function scoreAgentPlan(testCase: AgentEvalCase, plan: AgentPlan): AgentEvalResult {
  const failures: string[] = [];

  if (plan.primaryIntent !== testCase.expectedIntent) {
    failures.push(`expected intent ${testCase.expectedIntent}, received ${plan.primaryIntent}`);
  }

  if (plan.needsClarification !== testCase.needsClarification) {
    failures.push(`expected needsClarification ${testCase.needsClarification}, received ${plan.needsClarification}`);
  }

  if (plan.steps.length < testCase.minSteps || plan.steps.length > testCase.maxSteps) {
    failures.push(`expected step count between ${testCase.minSteps} and ${testCase.maxSteps}, received ${plan.steps.length}`);
  }

  const expectedCapabilities = formatCapabilities(testCase.expectedCapabilityIds);
  const actualCapabilities = formatCapabilities(plan.selectedCapabilityIds);
  if (expectedCapabilities !== actualCapabilities) {
    failures.push(`expected capabilities ${expectedCapabilities}, received ${actualCapabilities}`);
  }

  return {
    passed: failures.length === 0,
    failures,
  };
}
