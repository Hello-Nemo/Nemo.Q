import { ToolLoopAgent, stepCountIs } from 'ai';
import { createDeepSeek } from '@ai-sdk/deepseek';
import { dbTools } from '@/lib/tools/db';
import { chartTools } from '@/lib/tools/chart';

import fs from 'fs';
import path from 'path';

const deepseek = createDeepSeek({
  apiKey: process.env.DEEPSEEK_API_KEY,
});

const systemPrompt = fs.readFileSync(
  path.join(process.cwd(), 'src/lib/prompts/data-agent.md'),
  'utf8'
);

/**
 * 智能问数 Agent
 */
export const dataAgent = new ToolLoopAgent({
  model: deepseek('deepseek-v4-flash'),
  instructions: systemPrompt,
  tools: {
    ...dbTools,
    ...chartTools,
  },
  maxOutputTokens: 4096,
  temperature: 0.1,
  stopWhen: stepCountIs(30),
});
