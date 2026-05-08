import { ToolLoopAgent, stepCountIs } from 'ai';
import { createDeepSeek } from '@ai-sdk/deepseek';
import { dbTools } from '@/lib/tools/db';
import { chartTools } from '@/lib/tools/chart';

import fs from 'fs';
import path from 'path';
import {
  getActiveToolsForAgentStep,
  getLatestUserTextFromModelMessages,
} from './agent-routing';

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
const tools = {
  ...dbTools,
  ...chartTools,
};

export const dataAgent = new ToolLoopAgent({
  model: deepseek('deepseek-v4-flash'),
  instructions: systemPrompt,
  tools,
  maxOutputTokens: 2048,
  temperature: 0.1,
  prepareStep: ({ messages, steps }) => ({
    activeTools: getActiveToolsForAgentStep({
      latestUserText: getLatestUserTextFromModelMessages(messages),
      steps,
    }) as Array<keyof typeof tools>,
  }),
  stopWhen: [
    stepCountIs(12),
    ({ steps }) => {
      const lastStep = steps[steps.length - 1];
      if (!lastStep || !lastStep.toolResults) return false;
      return lastStep.toolResults.some((tr: any) => tr.result?.requires_action === true);
    }
  ],
});
