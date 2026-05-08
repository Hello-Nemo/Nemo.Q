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
export function createDataAgent(runtimeContext?: string) {
  const trimmedContext = runtimeContext?.trim();

  return new ToolLoopAgent({
    model: deepseek('deepseek-v4-flash'),
    instructions: trimmedContext ? `${systemPrompt}\n\n${trimmedContext}` : systemPrompt,
    tools: {
      ...dbTools,
      ...chartTools,
    },
    maxOutputTokens: 4096,
    temperature: 0.1,
    stopWhen: [
      stepCountIs(30),
      ({ steps }) => {
        const lastStep = steps[steps.length - 1];
        if (!lastStep || !lastStep.toolResults) return false;
        return lastStep.toolResults.some((tr: any) => tr.result?.requires_action === true);
      }
    ],
  });
}

export const dataAgent = createDataAgent();
