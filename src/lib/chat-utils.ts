import { COLUMN_LABELS, EXECUTION_TOOL_TYPES } from './chat-constants';
import type { DecisionOption } from '@/components/DecisionPrompt';
import type { AgentRunState, AgentTraceEvent } from '@/lib/agent/orchestrator/types';

/**
 * 判断一个值是否具有数值特征（数字或可解析为数字的字符串）
 */
export const isNumericLike = (value: any) => {
  if (typeof value === 'number') return Number.isFinite(value);
  return typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value));
};

/**
 * 强制将值转换为数字类型
 */
export const toNumber = (value: any) => (typeof value === 'number' ? value : Number(value));

/**
 * 格式化列标签，优先使用映射表，否则将下划线替换为空格并首字母大写
 */
export const formatColumnLabel = (key: string) => {
  if (COLUMN_LABELS[key]) return COLUMN_LABELS[key];
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

/**
 * 检查工具类型是否属于执行类工具
 */
export const isExecutionPartType = (type: string) => EXECUTION_TOOL_TYPES.has(type);

/**
 * 根据数据行自动构建图表配置（选取前两个数值列作为度量，第一个非数值列作为维度）
 */
export const buildChartSpecs = (rows: any[]) => {
  if (!rows?.length) return [];

  const keys = Object.keys(rows[0]);
  const numericKeys = keys.filter((key) => rows.some((row) => isNumericLike(row[key])));
  const dimensionKey = keys.find((key) => !numericKeys.includes(key)) || keys[0];

  return numericKeys.slice(0, 2).map((metricKey) => ({
    metricKey,
    dimensionKey,
    title: `${formatColumnLabel(metricKey)} 分布 (${formatColumnLabel(dimensionKey)})`,
    data: rows.map((row) => ({
      ...row,
      [metricKey]: toNumber(row[metricKey]),
    })),
  }));
};

/**
 * 获取消息片段的输入参数（抹平不同 SDK 版本的字段差异）
 */
export const getPartArgs = (part: any) => part?.args || part?.input || part?.invocation?.args || {};

/**
 * 获取消息片段的输出结果（抹平不同 SDK 版本的字段差异）
 */
export const getPartOutput = (part: any) => part?.output || part?.result;

/**
 * 构建澄清问题的决策选项列表
 */
export const buildClarificationOptions = (args: any): DecisionOption[] => {
  const baseOptions = Array.isArray(args.options) ? args.options : [];
  const decisionOptions: DecisionOption[] = baseOptions.map((option: any) => (
    typeof option === 'string'
      ? {
          label: option,
          value: option,
          recommended: option === args.recommendedOptionValue,
        }
      : {
          label: option.label,
          value: option.value,
          description: option.description,
          recommended: option.value === args.recommendedOptionValue,
        }
  ));

  // 添加默认选项
  const defaultAssumption = args.defaultAssumption && args.defaultAssumption !== '无'
    ? args.defaultAssumption
    : '让 NEMO.Q 依据当前上下文继续';

  if (decisionOptions.length > 0) {
    decisionOptions.push({
      label: '按默认理解继续',
      value: '跳过确认',
      description: defaultAssumption,
      recommended: !args.recommendedOptionValue,
    });
  }

  return decisionOptions;
};

export type AgentRunTimelineStep = {
  id: string;
  label: string;
  status: 'pending' | 'loading' | 'completed' | 'error';
};

export type AgentRunViewModel = {
  goal: string;
  status: AgentRunState['status'];
  selectedCapabilityIds: string[];
  steps: AgentRunTimelineStep[];
};

const mapRunStepStatus = (status: AgentRunState['plan']['steps'][number]['status']): AgentRunTimelineStep['status'] => {
  switch (status) {
    case 'running':
      return 'loading';
    case 'completed':
      return 'completed';
    case 'failed':
    case 'blocked':
      return 'error';
    case 'pending':
    default:
      return 'pending';
  }
};

const applyTraceEvent = (
  state: AgentRunState | undefined,
  event: AgentTraceEvent
): AgentRunState | undefined => {
  switch (event.type) {
    case 'run_created':
      return event.payload.state;
    case 'plan_created':
      return state
        ? {
            ...state,
            plan: event.payload.plan,
          }
        : state;
    case 'capability_selected':
      return state
        ? {
            ...state,
            plan: {
              ...state.plan,
              selectedCapabilityIds: event.payload.capabilityIds,
            },
          }
        : state;
    case 'step_started':
      return state
        ? {
            ...state,
            status: 'executing',
            currentStepId: event.payload.stepId,
            plan: {
              ...state.plan,
              steps: state.plan.steps.map((step) => (
                step.id === event.payload.stepId ? { ...step, status: 'running' } : step
              )),
            },
          }
        : state;
    case 'step_completed':
      return state
        ? {
            ...state,
            plan: {
              ...state.plan,
              steps: state.plan.steps.map((step) => (
                step.id === event.payload.stepId ? { ...step, status: 'completed' } : step
              )),
            },
          }
        : state;
    case 'run_completed':
      return event.payload.state;
    default:
      return state;
  }
};

export const buildLatestAgentRunViewModel = (parts: any[]): AgentRunViewModel | null => {
  const latestState = parts
    .filter((part) => part?.type === 'data-agent-run' && part?.data)
    .reduce<AgentRunState | undefined>((state, part) => (
      applyTraceEvent(state, part.data as AgentTraceEvent)
    ), undefined);

  if (!latestState) return null;

  return {
    goal: latestState.userGoal,
    status: latestState.status,
    selectedCapabilityIds: latestState.plan.selectedCapabilityIds,
    steps: latestState.plan.steps.map((step) => ({
      id: step.id,
      label: step.title,
      status: mapRunStepStatus(step.status),
    })),
  };
};

export const isLatestAgentRunPart = (parts: any[], index: number) => {
  if (parts[index]?.type !== 'data-agent-run') return false;

  return !parts.slice(index + 1).some((part) => part?.type === 'data-agent-run');
};
