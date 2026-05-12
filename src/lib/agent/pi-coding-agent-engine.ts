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
import { chartTools } from '../tools/chart';
import { commonTools } from '../tools/common';
import { bridgeTools } from './adapter/tool-bridge';
import { StreamProtocolAdapter } from './adapter/stream-protocol-adapter';
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
          // 1. 初始化 Auth 和 Model
          const authStorage = AuthStorage.create();
          
          if (process.env.DEEPSEEK_API_KEY) {
            authStorage.setRuntimeApiKey("deepseek", process.env.DEEPSEEK_API_KEY);
          }
          
          const modelRegistry = ModelRegistry.create(authStorage);
          
          // 2. 选择模型
          const targetModel = (options?.model || "deepseek-v4-flash") as "deepseek-v4-flash" | "deepseek-v4-pro";
          const model = getModel("deepseek", targetModel) || (await modelRegistry.getAvailable())[0];

          // 3. 基础工具 (框架级)
          const customTools = [
            ...bridgeTools(chartTools),
            ...bridgeTools(commonTools)
          ];

          // 4. 初始化 Loader (会自动加载 skills/ 目录)
          const promptPath = path.join(process.cwd(), 'src/lib/prompts/system-prompt.md');
          const systemPrompt = fs.existsSync(promptPath) ? fs.readFileSync(promptPath, 'utf8') : '';
          
          const loader = new DefaultResourceLoader({
            cwd: process.cwd(),
            agentDir: path.join(process.cwd(), '.pi'),
            systemPromptOverride: (current) => {
              const base = options?.runtimeContext 
                ? `${systemPrompt}\n\n${options.runtimeContext}\n\n始终使用中文回答。` 
                : `${systemPrompt}\n\n始终使用中文回答。`;
              return base;
            }
          });
          await loader.reload();

          // 5. 创建 Session 并还原历史
          const sessionManager = SessionManager.inMemory();
          
          // 还原历史消息 (不包含当前最后一条)
          await StreamProtocolAdapter.ingestHistory(sessionManager, messages.slice(0, -1));

          const { session } = await createAgentSession({
            cwd: process.cwd(),
            agentDir: path.join(process.cwd(), '.pi'),
            sessionManager,
            authStorage,
            modelRegistry,
            model,
            customTools,
            resourceLoader: loader
          });

          // 6. 转换历史消息并启动适配器
          const lastMessage = messages[messages.length - 1];
          
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

