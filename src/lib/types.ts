import type { dataAgent } from '@/lib/agent';
import type { InferAgentUIMessage } from 'ai';

// 从 agent 推断类型，获得完整的类型安全
export type DataAgentUIMessage = InferAgentUIMessage<typeof dataAgent>;
