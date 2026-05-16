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
import { StreamProtocolAdapter, toAgentRunDataPart } from './adapter/stream-protocol-adapter';
import { advanceStep, completeRun, startRun } from './orchestrator/runtime';
import fs from 'fs';
import path from 'path';

/**
 * Pi Coding Agent 引擎实现。
 *
 * 这个类仍然负责“和底层 Pi Runtime 对接”，
 * 但现在会在真正提示模型前后，挂接我们自己的 Orchestrator runtime：
 * - 前置：生成计划并发出 trace
 * - 后置：在运行结束时收束 run
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
          // 1. 初始化 Auth 和 Model：先把底层模型运行环境准备好。
          const authStorage = AuthStorage.create();
          
          if (process.env.DEEPSEEK_API_KEY) {
            authStorage.setRuntimeApiKey("deepseek", process.env.DEEPSEEK_API_KEY);
          }
          
          const modelRegistry = ModelRegistry.create(authStorage);
          
          // 2. 选择模型：UI 可以传入模型，否则走默认值。
          const targetModel = (options?.model || "deepseek-v4-flash") as "deepseek-v4-flash" | "deepseek-v4-pro";
          const model = getModel("deepseek", targetModel) || (await modelRegistry.getAvailable())[0];

          // 3. 框架级工具：这些工具直接挂到 Pi Agent，不属于某个具体业务 skill。
          const customTools = [
            ...bridgeTools(chartTools),
            ...bridgeTools(commonTools)
          ];

          // 4. 初始化 Loader：负责装载 system prompt 与 skills/ 资源。
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

          // 5. 创建 Session 并还原历史：让新一轮请求延续已有上下文。
          const sessionManager = SessionManager.inMemory();
          
          // 只还原历史，不把本轮最新用户消息提前塞进去。
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

          // 6. 提取本轮真正要交给模型的用户文本。
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

          // 在模型开始回答前，先让 Orchestrator 形成“计划视图”并写入 trace。
          let run = startRun(promptText, messageId);
          for (const event of run.events) {
            writer.write(toAgentRunDataPart(event) as any);
          }

          if (!run.state.plan.needsClarification) {
            // Phase 1 先只把第一步推进为执行中；
            // 后续可以让真实 tool 事件反向驱动更多步骤的流转。
            const firstStep = run.state.plan.steps[0];
            if (firstStep) {
              run = advanceStep(run, firstStep.id);
              writer.write(toAgentRunDataPart(run.events.at(-1)!) as any);
            }
          }

          // 7. 把原始请求交给底层模型执行。
          await session.prompt(promptText);
          
          // 等待底层模型的流式输出完整结束。
          await adapterPromise;

          if (run.state.status !== 'waiting_user') {
            // 如果当前不是“等用户补充信息”，则将这次 run 正常收束。
            run = completeRun(run);
            writer.write(toAgentRunDataPart(run.events.at(-1)!) as any);
          }
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
