import { AgentEngine } from './types';
import { AiSdkCoreEngine } from './ai-sdk-core-engine';
import { PiCodingAgentEngine } from './pi-coding-agent-engine';

export type EngineType = 'ai-sdk-core' | 'pi-coding-agent';

/**
 * Agent 引擎工厂
 */
export class AgentEngineFactory {
  static create(type: EngineType = 'pi-coding-agent'): AgentEngine {
    switch (type) {
      case 'ai-sdk-core':
        return new AiSdkCoreEngine();
      case 'pi-coding-agent':
        return new PiCodingAgentEngine();
      default:
        throw new Error(`Unsupported engine type: ${type}`);
    }
  }
}
