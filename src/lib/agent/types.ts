import { UIMessage } from 'ai';

export interface AgentEngineOptions {
  runtimeContext?: string;
  model?: string;
  onStreamUpdate?: (data: any) => void;
}

/**
 * 通用 Agent 引擎接口
 */
export interface AgentEngine {
  readonly id: string;
  readonly name: string;
  
  /**
   * 执行流式对话
   */
  stream(messages: UIMessage[], options?: AgentEngineOptions): Promise<Response>;
}
