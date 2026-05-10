import { createAgentUIStreamResponse, UIMessage } from 'ai';
import { AgentEngine, AgentEngineOptions } from './types';
import { createDataAgent } from '../agent';

/**
 * AI SDK Core 引擎实现
 */
export class AiSdkCoreEngine implements AgentEngine {
  readonly id = 'ai-sdk-core';
  readonly name = 'AI SDK Core (ToolLoopAgent)';

  async stream(messages: UIMessage[], options?: AgentEngineOptions): Promise<Response> {
    const agent = createDataAgent(options?.runtimeContext);
    
    return await createAgentUIStreamResponse({
      agent,
      uiMessages: messages,
    });
  }
}
