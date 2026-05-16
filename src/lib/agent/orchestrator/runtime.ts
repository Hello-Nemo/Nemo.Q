import { createPlan } from './planner';
import { listCapabilities } from './registry';
import type {
  AgentRunState,
  AgentTraceEvent,
} from './types';

/**
 * 运行时容器。
 *
 * `state` 是当前快照，`events` 是产生这个快照的轨迹。
 * 二者分开保存，方便：
 * 1. UI 直接读当前状态
 * 2. trace / eval 回放整个过程
 */
export interface AgentRun {
  state: AgentRunState;
  events: AgentTraceEvent[];
}

/** 追加一条 trace 事件，同时保持不可变更新，便于前端和测试做比较。 */
function appendEvent(run: AgentRun, event: AgentTraceEvent): AgentRun {
  return {
    state: run.state,
    events: [...run.events, event],
  };
}

/**
 * 启动一次新的运行。
 *
 * 这里完成 Phase 1 最关键的三件事：
 * 1. 先规划
 * 2. 初始化 run state
 * 3. 立即写出“创建运行 / 创建计划 / 选择能力”三类基础事件
 */
export function startRun(request: string, runId: string): AgentRun {
  const plan = createPlan(request, listCapabilities());
  const state: AgentRunState = {
    runId,
    userGoal: request,
    plan,
    status: plan.needsClarification ? 'waiting_user' : 'planned',
    observations: [],
  };

  return {
    state,
    events: [
      { type: 'run_created', payload: { state } },
      { type: 'plan_created', payload: { plan } },
      { type: 'capability_selected', payload: { capabilityIds: plan.selectedCapabilityIds } },
    ],
  };
}

/**
 * 把某个步骤推进为执行中。
 *
 * 这一步把“纸面计划”变成“真实运行”：
 * run 进入 `executing`，同时记录当前步骤是谁。
 */
export function advanceStep(run: AgentRun, stepId: string): AgentRun {
  const nextSteps = run.state.plan.steps.map((step) => (
    step.id === stepId ? { ...step, status: 'running' as const } : step
  ));

  const nextRun: AgentRun = {
    state: {
      ...run.state,
      status: 'executing',
      currentStepId: stepId,
      plan: {
        ...run.state.plan,
        steps: nextSteps,
      },
    },
    events: run.events,
  };

  return appendEvent(nextRun, {
    type: 'step_started',
    payload: { stepId },
  });
}

/**
 * 完成一次运行。
 *
 * Phase 1 先只把当前步骤标记完成，并收束整个 run。
 * 后续若要支持多步连续推进、失败恢复，可以在这里继续演进。
 */
export function completeRun(run: AgentRun): AgentRun {
  const currentStepId = run.state.currentStepId;
  const nextSteps = run.state.plan.steps.map((step) => (
    step.id === currentStepId ? { ...step, status: 'completed' as const } : step
  ));

  const nextState: AgentRunState = {
    ...run.state,
    status: 'completed',
    plan: {
      ...run.state.plan,
      steps: nextSteps,
    },
  };

  return appendEvent(
    {
      state: nextState,
      events: run.events,
    },
    {
      type: 'run_completed',
      payload: { state: nextState },
    }
  );
}
