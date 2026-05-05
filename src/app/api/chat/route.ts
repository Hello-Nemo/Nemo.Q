import { createAgentUIStreamResponse } from 'ai';
import { dataAgent } from '@/lib/agent';

export const maxDuration = 120; // 增加到 120s，以支持更复杂的链式思考和画像生成

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();
    
    if (!messages || messages.length === 0) {
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

    const cleanMessages = messages.map((m: any, idx: number) => ({
      id: m.id || `m-${idx}-${Date.now()}`,
      role: m.role,
      parts: Array.isArray(m.parts) ? m.parts : [{ type: 'text', text: m.content || '' }]
    })).filter((m: any) => m.role && m.parts.length > 0);

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
