import { createPlan } from './planner';
import { listCapabilities } from './registry';
import type {
  AgentRunState,
  AgentTraceEvent,
} from './types';

export interface AgentRun {
  state: AgentRunState;
  events: AgentTraceEvent[];
}

function appendEvent(run: AgentRun, event: AgentTraceEvent): AgentRun {
  return {
    state: run.state,
    events: [...run.events, event],
  };
}

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
