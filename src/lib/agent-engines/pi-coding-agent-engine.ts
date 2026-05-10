import { createUIMessageStream, createUIMessageStreamResponse, UIMessage, generateId } from 'ai';
import { AgentEngine, AgentEngineOptions } from './types';
import { 
  createAgentSession, 
  SessionManager, 
  AuthStorage, 
  ModelRegistry,
  DefaultResourceLoader
} from "@earendil-works/pi-coding-agent";
import { getModel } from "@earendil-works/pi-ai";
import { dbTools } from '../tools/db';
import { chartTools } from '../tools/chart';
import { bridgeTools } from '../pi-agent/tool-bridge';
import { StreamProtocolAdapter } from '../pi-agent/stream-protocol-adapter';
import fs from 'fs';
import path from 'path';

/**
 * Pi Coding Agent 引擎实现
 */
export class PiCodingAgentEngine implements AgentEngine {
  readonly id = 'pi-coding-agent';
  readonly name = 'Pi Coding Agent';

  async stream(messages: UIMessage[], options?: AgentEngineOptions): Promise<Response> {
    console.log('[PiCodingAgentEngine] Starting stream...');
    const stream = createUIMessageStream({
      originalMessages: messages,
      execute: async ({ writer }) => {
        const messageId = generateId();
        try {
          console.log('[PiCodingAgentEngine] Inside execute...');
          // 1. 初始化 Auth 和 Model
          const authStorage = AuthStorage.create();
          console.log('[PiCodingAgentEngine] AuthStorage created');

          if (process.env.DEEPSEEK_API_KEY) {
            authStorage.setRuntimeApiKey("deepseek", process.env.DEEPSEEK_API_KEY);
            console.log('[PiCodingAgentEngine] API Key set');
          }
          
          const modelRegistry = ModelRegistry.create(authStorage);
          console.log('[PiCodingAgentEngine] ModelRegistry created');
          
          // 2. 选择模型
          const model = getModel("deepseek", "deepseek-chat") || (await modelRegistry.getAvailable())[0];
          console.log('[PiCodingAgentEngine] Model selected:', model?.provider, model?.id);

          // 3. 准备工具
          const customTools = [
            ...bridgeTools(dbTools),
            ...bridgeTools(chartTools)
          ];
          console.log('[PiCodingAgentEngine] Tools bridged');

          // 4. 加载系统提示词
          const promptPath = path.join(process.cwd(), 'src/lib/prompts/data-agent.md');
          console.log('[PiCodingAgentEngine] Prompt path:', promptPath);
          const systemPrompt = fs.readFileSync(promptPath, 'utf8');

          const instructions = options?.runtimeContext 
            ? `${systemPrompt}\n\n${options.runtimeContext}` 
            : systemPrompt;

          // 5. 创建 Session
          console.log('[PiCodingAgentEngine] Creating session...');
          const { session } = await createAgentSession({
            cwd: process.cwd(),
            agentDir: path.join(process.cwd(), '.pi'),
            sessionManager: SessionManager.inMemory(),
            authStorage,
            modelRegistry,
            model,
            customTools,
            resourceLoader: new DefaultResourceLoader({
              cwd: process.cwd(),
              agentDir: path.join(process.cwd(), '.pi'),
              systemPromptOverride: () => instructions
            })
          });
          console.log('[PiCodingAgentEngine] Session created');

          // 6. 转换历史消息并启动适配器
          const lastMessage = messages[messages.length - 1];
          console.log('[PiCodingAgentEngine] Last message:', JSON.stringify(lastMessage));
          
          const promptText = lastMessage.parts
            .filter(part => part.type === 'text')
            .map(part => (part as any).text || (part as any).delta || '')
            .join('\n');

          console.log('[PiCodingAgentEngine] Prompt text:', promptText);

          if (!promptText) {
            throw new Error('No text content found in the last message');
          }

          const adapter = new StreamProtocolAdapter(writer, session, messageId);
          const adapterPromise = adapter.adapt();

          // 7. 发送 Prompt
          await session.prompt(promptText);
          
          // 等待流结束
          await adapterPromise;
        } catch (error: any) {
          console.error('[PiCodingAgentEngine] FATAL ERROR:', error);
          if (error.stack) {
            console.error(error.stack);
          }
          // 发送错误消息
          writer.write({ type: 'text-start', id: messageId });
          writer.write({
            type: 'text-delta',
            id: messageId,
            delta: `Error: ${error.message}\n\nStack: ${error.stack}`
          });
          writer.write({ type: 'text-end', id: messageId });
        }
      }
    });

    return createUIMessageStreamResponse({ stream });
  }
}
