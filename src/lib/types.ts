import type { UIMessage } from 'ai';
import type { AgentTraceEvent } from '@/lib/agent/orchestrator/types';

/**
 * 统一的 Message 类型定义，不再依赖具体的 Agent 实例
 */
export type DataAgentUIMessage = UIMessage;

export type TimestampedDataAgentUIMessage = DataAgentUIMessage & {
  createdAt?: string | number | Date;
};

export type AgentRunDataPart = {
  type: 'data-agent-run';
  data: AgentTraceEvent;
};
