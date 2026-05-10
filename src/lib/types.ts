import type { UIMessage } from 'ai';

/**
 * 统一的 Message 类型定义，不再依赖具体的 Agent 实例
 */
export type DataAgentUIMessage = UIMessage;

export type TimestampedDataAgentUIMessage = DataAgentUIMessage & {
  createdAt?: string | number | Date;
};
