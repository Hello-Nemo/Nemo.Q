import { UIMessageStreamWriter, UIMessage, generateId } from 'ai';
import { AgentSession } from "@earendil-works/pi-coding-agent";
import type { AgentTraceEvent } from '../orchestrator/types';

/**
 * 把 Orchestrator trace 事件包装成 AI SDK 能随消息流传输的自定义 data part。
 *
 * 这样前端不需要另开一条 SSE / WebSocket 通道，
 * 仍然可以在原有聊天流里还原运行时间线。
 */
export function toAgentRunDataPart(event: AgentTraceEvent) {
  return {
    type: 'data-agent-run' as const,
    data: event,
  };
}

/**
 * 将 Pi Agent 的事件流适配为 AI SDK UI 协议
 */
export class StreamProtocolAdapter {
  private hasStartedText = false;
  private currentTextId = generateId();
  private hasStartedReasoning = false;
  private reasoningId = generateId();
  private pendingToolDeltas = new Map<number, string[]>();
  private pendingContentIndices: number[] = [];

  constructor(
    private writer: UIMessageStreamWriter<UIMessage>,
    private session: AgentSession,
    private messageId: string
  ) {
    this.currentTextId = generateId();
  }

  /** 结束当前文本块并准备接收新的文本片段。 */
  private startNewTextPart() {
    if (this.hasStartedText) {
      this.writer.write({ type: 'text-end', id: this.currentTextId });
    }
    this.currentTextId = generateId();
    this.hasStartedText = false;
  }

  /** 结束当前 reasoning 块并准备新的 reasoning 片段。 */
  private startNewReasoningPart() {
    if (this.hasStartedReasoning) {
      this.writer.write({ type: 'reasoning-end', id: this.reasoningId });
    }
    this.reasoningId = generateId();
    this.hasStartedReasoning = false;
  }

  async adapt() {
    console.log('[StreamProtocolAdapter] Starting adaptation...');
    this.writer.write({ type: 'start', messageId: this.messageId });

    return new Promise<void>((resolve) => {
      const unsubscribe = this.session.subscribe((event) => {
        try {
          switch (event.type) {
            case "message_update":
              const assistantEvent = event.assistantMessageEvent;
              switch (assistantEvent.type) {
                case "text_start":
                  if (this.hasStartedReasoning || this.hasStartedText) {
                    this.startNewReasoningPart();
                    this.startNewTextPart();
                  }
                  if (!this.hasStartedText) {
                    this.writer.write({ type: 'text-start', id: this.currentTextId });
                    this.hasStartedText = true;
                  }
                  break;

                case "text_delta":
                  if (this.hasStartedReasoning) {
                    this.startNewReasoningPart();
                    this.startNewTextPart();
                  }
                  if (!this.hasStartedText) {
                    this.writer.write({ type: 'text-start', id: this.currentTextId });
                    this.hasStartedText = true;
                  }
                  this.writer.write({
                    type: 'text-delta',
                    id: this.currentTextId,
                    delta: assistantEvent.delta
                  });
                  break;

                case "thinking_start":
                  if (this.hasStartedText || this.hasStartedReasoning) {
                    this.startNewTextPart();
                    this.startNewReasoningPart();
                  }
                  if (!this.hasStartedReasoning) {
                    this.writer.write({ type: 'reasoning-start', id: this.reasoningId });
                    this.hasStartedReasoning = true;
                  }
                  break;

                case "thinking_delta":
                  if (!this.hasStartedReasoning) {
                    this.startNewTextPart();
                    this.startNewReasoningPart();
                    this.writer.write({ type: 'reasoning-start', id: this.reasoningId });
                    this.hasStartedReasoning = true;
                  }
                  this.writer.write({
                    type: 'reasoning-delta',
                    id: this.reasoningId,
                    delta: assistantEvent.delta
                  });
                  break;

                case "thinking_end":
                  if (this.hasStartedReasoning) {
                    this.writer.write({ type: 'reasoning-end', id: this.reasoningId });
                    this.hasStartedReasoning = false;
                  }
                  break;

                case "toolcall_start": {
                  // Pi 的 tool call 可能会在参数尚未完整时先发出开始事件；
                  // 这里先占位，后续再把完整参数补进 UI 流。
                  this.startNewTextPart();
                  this.startNewReasoningPart();
                  this.pendingContentIndices.push(assistantEvent.contentIndex);
                  const toolCallId = (assistantEvent as any).id || generateId();
                  this.writer.write({
                    type: 'tool-input-start',
                    toolCallId,
                    toolName: (assistantEvent as any).toolName || 'unknown'
                  });
                  break;
                }

                case "toolcall_delta": {
                  const contentIndex = assistantEvent.contentIndex;
                  const toolCallId = (assistantEvent as any).id;
                  if (toolCallId) {
                    this.writer.write({
                      type: 'tool-input-delta',
                      toolCallId,
                      inputTextDelta: assistantEvent.delta
                    });
                  } else {
                    // 某些 Pi 事件在 delta 阶段还没有 toolCallId，
                    // 先按 contentIndex 暂存，等真正执行时再回填。
                    if (!this.pendingToolDeltas.has(contentIndex)) {
                      this.pendingToolDeltas.set(contentIndex, []);
                    }
                    this.pendingToolDeltas.get(contentIndex)!.push(assistantEvent.delta);
                  }
                  break;
                }
              }
              break;

            case "tool_execution_start": {
              const contentIndex = this.pendingContentIndices.shift() ?? 0;
              if (this.hasStartedText) this.startNewTextPart();
              
              this.writer.write({
                type: 'tool-input-start',
                toolCallId: event.toolCallId,
                toolName: event.toolName
              });
              
              if (this.pendingToolDeltas.has(contentIndex)) {
                // 把之前缓存的输入增量补发给前端，确保 UI 能看到完整参数。
                for (const delta of this.pendingToolDeltas.get(contentIndex)!) {
                  this.writer.write({
                    type: 'tool-input-delta',
                    toolCallId: event.toolCallId,
                    inputTextDelta: delta
                  });
                }
                this.pendingToolDeltas.delete(contentIndex);
              }
              
              this.writer.write({
                type: 'tool-input-available',
                toolCallId: event.toolCallId,
                toolName: event.toolName,
                input: event.args || {}
              });
              break;
            }

            case "tool_execution_end": {
              let result = event.result;
              if (result && typeof result === 'object' && 'details' in result) {
                // bridgeTools 会保留一层 details 备份；
                // UI 只需要真正的业务结果，所以这里做一次展开。
                result = result.details;
              }
              this.writer.write({
                type: 'tool-output-available',
                toolCallId: event.toolCallId,
                output: result ?? {}
              });
              break;
            }

            case "agent_end":
              if (this.hasStartedReasoning) this.writer.write({ type: 'reasoning-end', id: this.reasoningId });
              if (this.hasStartedText) this.writer.write({ type: 'text-end', id: this.currentTextId });
              this.writer.write({ type: 'finish-step' });
              this.writer.write({ type: 'finish' });
              unsubscribe();
              resolve();
              break;

            case "auto_retry_start":
              this.writer.write({
                type: 'data-retry',
                data: { status: 'retrying', attempt: event.attempt, message: event.errorMessage }
              });
              break;
          }
        } catch (error) {
          console.error('[StreamProtocolAdapter] Error during adaptation:', error);
        }
      });
    });
  }

  /**
   * 将 UI 消息历史摄取到 Pi Agent 的 SessionManager 中
   */
  static async ingestHistory(sessionManager: any, messages: UIMessage[]) {
    for (const m of messages) {
      try {
        switch (m.role as string) {
          case 'user':
            const text = m.parts.filter(p => p.type === 'text').map(p => (p as any).text).join('\n');
            if (text) sessionManager.appendMessage({ role: 'user', content: text, timestamp: Date.now() });
            break;

          case 'assistant':
            const content = m.parts.map(p => this.mapAssistantPart(p)).filter(Boolean);
            if (content.length > 0) {
              sessionManager.appendMessage({
                role: 'assistant',
                content,
                timestamp: Date.now(),
                api: 'openai-responses', provider: 'deepseek', model: 'deepseek-v4-flash',
                usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
                stopReason: 'stop'
              } as any);
            }
            break;

          case 'tool':
            m.parts.forEach(p => {
              if (p.type === 'tool-result' || p.type.startsWith('tool-')) {
                sessionManager.appendMessage({
                  role: 'toolResult',
                  toolCallId: (p as any).toolCallId,
                  toolName: (p as any).toolName || p.type.replace('tool-', ''),
                  content: [{ type: 'text', text: JSON.stringify((p as any).result || (p as any).output) }],
                  isError: (p as any).isError || false,
                  timestamp: Date.now()
                } as any);
              }
            });
            break;
        }
      } catch (err) {
        console.warn('[StreamProtocolAdapter] Failed to ingest history message:', err);
      }
    }
  }

  private static mapAssistantPart(p: any) {
    if (p.type === 'text') return { type: 'text', text: p.text || '' };
    if (p.type === 'reasoning') return { type: 'thinking', thinking: p.text || '' };
    if (p.type === 'tool-invocation' || p.type === 'tool-call' || p.type.startsWith('tool-')) {
      return {
        type: 'toolCall',
        id: p.toolCallId,
        name: p.toolName || p.type.replace('tool-', ''),
        arguments: p.args || p.input || {}
      };
    }
    return null;
  }
}
