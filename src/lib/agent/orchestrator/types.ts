/**
 * Orchestrator 共享协议层。
 *
 * 这一层只定义“系统里有哪些对象”，不放业务逻辑。
 * registry、planner、runtime、UI trace 都依赖这里的类型，
 * 这样可以避免每一层各自发明一套计划/状态结构。
 */
export const RUN_STATUSES = [
  'received',
  'planned',
  'executing',
  'waiting_user',
  'completed',
  'failed',
] as const;

/** 一次 Agent 运行从开始到结束可能处于的阶段。 */
export type AgentRunStatus = (typeof RUN_STATUSES)[number];

/** 当前 Phase 1 先覆盖最常见的高层意图类型。 */
export type AgentIntent = 'answer' | 'analyze' | 'execute' | 'research' | 'create' | 'clarify';

/** 用来区分“直接回答”与“需要拆解”的任务复杂度。 */
export type AgentComplexity = 'simple' | 'multi_step';

/** 当前步骤由 Orchestrator 自己完成，还是要委派给 skill。 */
export type StepExecutionMode = 'self' | 'skill';

/** 单个计划步骤在生命周期中的状态。 */
export type AgentPlanStepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'blocked';

/** 能力风险等级，后续可以扩展为更细的安全策略。 */
export type CapabilityRisk = 'low' | 'medium' | 'high';

/** 能力调用成本，后续可用于路由和预算决策。 */
export type CapabilityCost = 'low' | 'medium' | 'high';

/**
 * Orchestrator 眼中的“能力定义”。
 *
 * 这里描述的是能力的机器可读画像，而不是 skill 的实现细节。
 * 后续无论能力来自本地 skill、远程工具还是子 Agent，都可以先归一到这个结构。
 */
export interface CapabilityDefinition {
  id: string;
  name: string;
  description: string;
  domains: string[];
  intents: AgentIntent[];
  risk: CapabilityRisk;
  cost: CapabilityCost;
}

/**
 * 计划中的一个原子步骤。
 *
 * `requiredCapabilityIds` 表示这一步理论上需要哪些能力，
 * 让后续执行层能对照“计划要用什么”和“实际用了什么”。
 */
export interface AgentPlanStep {
  id: string;
  title: string;
  objective: string;
  requiredCapabilityIds: string[];
  executionMode: StepExecutionMode;
  expectedOutput: string;
  status: AgentPlanStepStatus;
}

/**
 * 规划器的输出。
 *
 * 这是“用户一句话”被 Orchestrator 理解后的结构化版本：
 * 目标是什么、任务属于哪一类、是否要澄清、要走哪些步骤。
 */
export interface AgentPlan {
  goal: string;
  primaryIntent: AgentIntent;
  complexity: AgentComplexity;
  selectedCapabilityIds: string[];
  needsClarification: boolean;
  steps: AgentPlanStep[];
}

/** 执行过程中产生的中间观察，后续可用于反思、恢复和总结。 */
export interface AgentObservation {
  stepId: string;
  summary: string;
}

/**
 * 一次运行的完整状态快照。
 *
 * 与聊天消息不同，这个对象表达的是 Agent“做到哪一步了”，
 * 是 Super Agent 从聊天机器人迈向可恢复运行时的关键。
 */
export interface AgentRunState {
  runId: string;
  userGoal: string;
  plan: AgentPlan;
  currentStepId?: string;
  status: AgentRunStatus;
  observations: AgentObservation[];
}

/**
 * Trace 事件流。
 *
 * UI 不直接猜测运行时状态，而是消费这些事件再重建时间线。
 * 这样同一套事件既可用于前端展示，也可用于后续评测和调试。
 */
export type AgentTraceEvent =
  | { type: 'run_created'; payload: { state: AgentRunState } }
  | { type: 'plan_created'; payload: { plan: AgentPlan } }
  | { type: 'capability_selected'; payload: { capabilityIds: string[] } }
  | { type: 'step_started'; payload: { stepId: string } }
  | { type: 'step_completed'; payload: { stepId: string } }
  | { type: 'run_completed'; payload: { state: AgentRunState } };
