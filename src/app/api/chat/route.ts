import { createAgentUIStreamResponse } from 'ai';
import { createDataAgent } from '@/lib/agent';

export const maxDuration = 120; // 增加到 120s，以支持更复杂的链式思考和画像生成

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();
    
    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: 'No messages provided' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const runtimeContext = `
<RUNTIME_CONTEXT>
- Current Time: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}
</RUNTIME_CONTEXT>
`;

    const cleanMessages = messages
      .map((m: any, idx: number) => ({
        id: m.id || `m-${idx}-${Date.now()}`,
        role: m.role,
        parts: Array.isArray(m.parts) ? m.parts : [{ type: 'text', text: m.content || '' }]
      }))
      .filter((m: any) => (
        (m.role === 'user' || m.role === 'assistant') &&
        m.parts.length > 0
      ));

    if (cleanMessages.length === 0) {
      return new Response(JSON.stringify({ error: 'No valid chat messages provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return await createAgentUIStreamResponse({
      agent: createDataAgent(runtimeContext),
      uiMessages: cleanMessages,
    });
  } catch (error: any) {
    console.error('[CHAT_API_ERROR]', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Internal Server Error',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
