import { dbTools } from '@/lib/tools/db';
import { chartTools } from '@/lib/tools/chart';
import { normalizeToolResult } from './tool-result-normalizer';

function wrapTool(toolName: string, baseTool: any) {
  return {
    ...baseTool,
    execute: async (input: any, options: any) => {
      const result = await baseTool.execute(input, options);
      return normalizeToolResult({
        toolName,
        result,
        input,
      });
    },
  };
}

export const policyAwareDbTools = Object.fromEntries(
  Object.entries(dbTools).map(([name, baseTool]) => [
    name,
    wrapTool(name, baseTool),
  ])
);

// chartTools 也可以根据需要包装，但目前 dbTools 是核心
export const policyAwareTools = {
  ...policyAwareDbTools,
  ...chartTools,
};
