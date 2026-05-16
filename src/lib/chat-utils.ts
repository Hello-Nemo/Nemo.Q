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

/** 前端渲染时间线真正需要的最小视图模型。 */
export type AgentRunViewModel = {
  goal: string;
  status: AgentRunState['status'];
  selectedCapabilityIds: string[];
  steps: AgentRunTimelineStep[];
};

/** 把运行时步骤状态转换成现有 Timeline 组件能理解的 UI 状态。 */
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

/**
 * 用一条 trace 事件，推进一份可供 UI 使用的运行状态。
 *
 * 这相当于前端侧的轻量 reducer：
 * 服务端不断发事件，前端按顺序“回放”后得到最新状态。
 */
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

/**
 * 从整条消息的 data parts 中，重建最新一次 run 的视图模型。
 *
 * 不把完整 run state 直接绑死在 UI 上，而是先收敛成更稳定的展示结构，
 * 这样后续 runtime 扩展字段时，前端不需要跟着一起剧烈变化。
 */
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

/** 只渲染最新一条 run trace，避免一串事件各自生成重复时间线。 */
export const isLatestAgentRunPart = (parts: any[], index: number) => {
  if (parts[index]?.type !== 'data-agent-run') return false;

  return !parts.slice(index + 1).some((part) => part?.type === 'data-agent-run');
};
