import type { UIMessage } from 'ai';
import type { AgentTraceEvent } from '@/lib/agent/orchestrator/types';

/**
 * 统一的 Message 类型定义，不再依赖具体的 Agent 实例
 */
export type DataAgentUIMessage = UIMessage;

export type TimestampedDataAgentUIMessage = DataAgentUIMessage & {
  createdAt?: string | number | Date;
};

/**
 * Orchestrator trace 在聊天消息中的自定义 data part。
 *
 * 它让“Agent 正在怎么做”也成为消息协议的一部分，
 * 而不是只能靠日志或模型文本来猜测。
 */
export type AgentRunDataPart = {
  type: 'data-agent-run';
  data: AgentTraceEvent;
};
