import type { AgentIntent, AgentPlan } from './types';

/**
 * 一条 Super Agent 评测样例。
 *
 * 和传统“最终答案对不对”不同，这里先测运行行为：
 * 意图有没有分对、能力有没有选对、澄清是否触发、计划长度是否合理。
 */
export type AgentEvalCase = {
  id: string;
  request: string;
  expectedIntent: AgentIntent;
  expectedCapabilityIds: string[];
  needsClarification: boolean;
  minSteps: number;
  maxSteps: number;
};

/** 单条评测的结构化结果，便于脚本统一汇总。 */
export type AgentEvalResult = {
  passed: boolean;
  failures: string[];
};

/** 统一格式化能力列表，让失败信息更容易读。 */
const formatCapabilities = (capabilityIds: string[]) => (
  capabilityIds.length > 0 ? capabilityIds.join(', ') : 'none'
);

/**
 * 给一份计划打分。
 *
 * 这类 eval 是学习 Super Agent 时很有价值的切面：
 * 它关注的是“Agent 怎样组织行动”，而不是只看最终文本像不像。
 */
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
