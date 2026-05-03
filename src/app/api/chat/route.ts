import { createAgentUIStreamResponse } from 'ai';
import { dataAgent } from '@/lib/agent';

export const maxDuration = 60; // 允许较长的查询时间

export async function POST(req: Request) {
  const { messages } = await req.json();

  return createAgentUIStreamResponse({
    agent: dataAgent,
    uiMessages: messages,
  });
}
