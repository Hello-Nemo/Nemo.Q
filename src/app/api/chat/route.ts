import { createAgentUIStreamResponse } from 'ai';
import { dataAgent } from '@/lib/agent';
import { sanitizeChatMessagesForAgent } from '@/lib/chat-message-sanitizer';
import { getLatestUserTextFromModelMessages } from '@/lib/agent-routing';
import {
  formatIntentCandidatesForPrompt,
  generateIntentCandidates,
} from '@/lib/ask/intent-candidates';
import semanticLayer from '@/lib/semantic-layer.json' with { type: 'json' };
import type { SemanticLayer } from '@/lib/semantic/types';

export const maxDuration = 120; // 增加到 120s，以支持更复杂的链式思考和画像生成

// 解决 BigInt 序列化问题
if (!(BigInt.prototype as any).toJSON) {
  (BigInt.prototype as any).toJSON = function () {
    return this.toString();
  };
}


export async function POST(req: Request) {
  try {
    const { messages } = await req.json();
    
    if (!messages || messages.length === 0) {
      return new Response(JSON.stringify({ error: 'No messages provided' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const cleanMessages = sanitizeChatMessagesForAgent(messages, {
      maxMessages: 10,
      keepRecentToolMessages: 1,
    });
    const latestUserText = getLatestUserTextFromModelMessages(cleanMessages);
    const intentCandidateContext = latestUserText
      ? formatIntentCandidatesForPrompt(generateIntentCandidates({
          question: latestUserText,
          semanticLayer: semanticLayer as SemanticLayer,
        }))
      : '';

    const runtimeContext = `
<RUNTIME_CONTEXT>
- Current Time: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}
${intentCandidateContext}
</RUNTIME_CONTEXT>
`;

    return await createAgentUIStreamResponse({
      agent: dataAgent,
      uiMessages: [
        { 
          id: `sys-${Date.now()}`,
          role: 'system', 
          parts: [{ type: 'text', text: runtimeContext }] 
        },
        ...cleanMessages
      ],
    });

  } catch (error: any) {
    console.error('[CHAT_API_CRITICAL_ERROR]', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Internal Server Error',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      type: error.name
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

}
