import { UIMessageStreamWriter, UIMessage, InferUIMessageChunk } from 'ai';
import { AgentSession } from "@earendil-works/pi-coding-agent";

/**
 * 将 Pi Agent 的事件流适配为 AI SDK UI 协议
 */
export class StreamProtocolAdapter {
  private hasStartedText = false;
  private hasStartedReasoning = false;

  constructor(
    private writer: UIMessageStreamWriter<UIMessage>,
    private session: AgentSession,
    private messageId: string
  ) {}

  /**
   * 开始监听并适配事件
   */
  async adapt() {
    console.log('[StreamProtocolAdapter] Starting adaptation...');
    return new Promise<void>((resolve) => {
      const unsubscribe = this.session.subscribe((event) => {
        try {
          console.log('[StreamProtocolAdapter] Received event:', event.type);
          switch (event.type) {
            case "message_update":
              console.log('[StreamProtocolAdapter] Message update type:', event.assistantMessageEvent.type);
              if (event.assistantMessageEvent.type === "text_delta") {
                console.log('[StreamProtocolAdapter] Text delta:', event.assistantMessageEvent.delta);
                // 如果正在推理，先结束推理
                if (this.hasStartedReasoning) {
                  this.writer.write({ type: 'reasoning-end', id: this.messageId });
                  this.hasStartedReasoning = false;
                }
                if (!this.hasStartedText) {
                  this.writer.write({ type: 'text-start', id: this.messageId });
                  this.hasStartedText = true;
                }
                this.writer.write({
                  type: 'text-delta',
                  id: this.messageId,
                  delta: event.assistantMessageEvent.delta
                });
              } else if (event.assistantMessageEvent.type === "thinking_delta") {
                if (!this.hasStartedReasoning) {
                  this.writer.write({ type: 'reasoning-start', id: this.messageId });
                  this.hasStartedReasoning = true;
                }
                this.writer.write({
                  type: 'reasoning-delta',
                  id: this.messageId,
                  delta: event.assistantMessageEvent.delta
                });
              }
              break;

            case "tool_execution_start":
              // 注意：AI SDK 6.0 使用 tool-input-available 而非 tool-call
              this.writer.write({
                type: 'tool-input-available',
                toolCallId: event.toolCallId,
                toolName: event.toolName,
                input: event.args
              });
              break;

            case "tool_execution_end":
              // 注意：AI SDK 6.0 使用 tool-output-available 而非 tool-result
              this.writer.write({
                type: 'tool-output-available',
                toolCallId: event.toolCallId,
                output: event.result
              });
              break;

            case "agent_end":
              // Agent 运行结束，关闭所有打开的部件
              if (this.hasStartedReasoning) {
                this.writer.write({ type: 'reasoning-end', id: this.messageId });
              }
              if (this.hasStartedText) {
                this.writer.write({ type: 'text-end', id: this.messageId });
              }
              unsubscribe();
              resolve();
              break;

            case "auto_retry_start":
              this.writer.write({
                type: 'data',
                value: { status: 'retrying', attempt: event.attempt, message: event.errorMessage }
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
