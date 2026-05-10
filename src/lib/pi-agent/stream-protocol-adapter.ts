import { UIMessageStreamWriter, UIMessage, generateId } from 'ai';
import { AgentSession } from "@earendil-works/pi-coding-agent";

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
    this.currentTextId = generateId(); // 始终使用新生成的 ID，确保它是独立的
  }

  /**
   * 开启新的文本段落 ID，确保新内容出现在底部
   */
  private startNewTextPart() {
    if (this.hasStartedText) {
      this.writer.write({ type: 'text-end', id: this.currentTextId });
    }
    this.currentTextId = generateId();
    this.hasStartedText = false;
  }

  /**
   * 开启新的推理段落 ID
   */
  private startNewReasoningPart() {
    if (this.hasStartedReasoning) {
      this.writer.write({ type: 'reasoning-end', id: this.reasoningId });
    }
    this.reasoningId = generateId();
    this.hasStartedReasoning = false;
  }

  /**
   * 开始监听并适配事件
   */
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
                  // 只要开始了新的文字段落，如果之前在推理或输出工具，就强制另起一段
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
                  // 推理开始，也要另起一段，确保它在当前所有内容的下方
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
                  // 工具调用开始，也要确保之前的文本和推理已正确断开
                  this.startNewTextPart();
                  this.startNewReasoningPart();
                  
                  this.pendingContentIndices.push(assistantEvent.contentIndex);
                  // 如果能从事件中直接拿到 ID，则可以尝试提前发送 tool-input-start
                  const toolCallId = (assistantEvent as any).id;
                  if (toolCallId) {
                    this.writer.write({
                      type: 'tool-input-start',
                      toolCallId,
                      toolName: (assistantEvent as any).toolName
                    });
                  }
                  break;
                }

                case "toolcall_delta": {
                  const contentIndex = assistantEvent.contentIndex;
                  const toolCallId = (assistantEvent as any).id;
                  
                  if (toolCallId) {
                    // 如果有 ID，直接流式发送
                    this.writer.write({
                      type: 'tool-input-delta',
                      toolCallId,
                      inputTextDelta: assistantEvent.delta
                    });
                  } else {
                    // 否则继续缓冲
                    if (!this.pendingToolDeltas.has(contentIndex)) {
                      this.pendingToolDeltas.set(contentIndex, []);
                    }
                    this.pendingToolDeltas.get(contentIndex)!.push(assistantEvent.delta);
                  }
                  break;
                }

                case "toolcall_end":
                  break;
              }
              break;

            case "tool_execution_start": {
              const contentIndex = this.pendingContentIndices.shift() ?? 0;
              
              // 如果正在输出文本，断开它
              if (this.hasStartedText) {
                this.startNewTextPart();
              }
              
              // 确保 tool-input-start 已发送（如果之前没发过）
              this.writer.write({
                type: 'tool-input-start',
                toolCallId: event.toolCallId,
                toolName: event.toolName
              });
              
              // 发送缓冲的 delta
              if (this.pendingToolDeltas.has(contentIndex)) {
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
                input: event.args
              });
              break;
            }

            case "tool_execution_end": {
              let result = event.result;
              // 自动解包 Pi Agent 的内容包装
              if (result && typeof result === 'object' && 'details' in result) {
                result = result.details;
              }
              
              this.writer.write({
                type: 'tool-output-available',
                toolCallId: event.toolCallId,
                output: result
              });
              break;
            }

            case "agent_end":
              if (this.hasStartedReasoning) {
                this.writer.write({ type: 'reasoning-end', id: this.reasoningId });
              }
              if (this.hasStartedText) {
                this.writer.write({ type: 'text-end', id: this.currentTextId });
              }
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
}
