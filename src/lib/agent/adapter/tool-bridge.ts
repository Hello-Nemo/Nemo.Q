import { defineTool } from "@earendil-works/pi-coding-agent";
import { z } from "zod";

/**
 * 将 AI SDK 的 Tool 转换为 Pi Agent 的 Tool
 */
export function bridgeTool(aiSdkTool: any, name: string) {
  const inputSchema = aiSdkTool.inputSchema || aiSdkTool.parameters;
  if (!inputSchema) {
    throw new Error(`Tool ${name} has no inputSchema or parameters`);
  }
  const jsonSchema = inputSchema.toJSON ? inputSchema.toJSON() : inputSchema;
  
  // 移除可能导致 TypeBox 报错的属性
  if (jsonSchema && typeof jsonSchema === 'object') {
    delete (jsonSchema as any).$schema;
    delete (jsonSchema as any).additionalProperties;
  }

  return defineTool({
    name: name,
    label: aiSdkTool.description || name, // Pi Agent 要求的 label 字段
    description: aiSdkTool.description || "",
    // Pi 使用 TypeBox，但底层其实是 JSON Schema
    // 我们可以尝试直接传入转换后的 schema
    parameters: jsonSchema as any,
    execute: async (toolCallId, params) => {
      try {
        const result = await aiSdkTool.execute(params);
        return {
          content: [{ type: "text", text: typeof result === 'string' ? result : JSON.stringify(result, null, 2) }],
          // 深度展开：如果 result 是对象，直接平铺它的所有字段到根部
          // 这样前端就可以直接访问 output.data 而不需要 output.details.data
          ...(typeof result === 'object' ? result : {}),
          details: result, // 保留一份作为备份
        };
      } catch (error: any) {
        return {
          content: [{ type: "text", text: `Error: ${error.message}` }],
          isError: true,
          details: { error: error.message },
        };
      }
    },
  });
}

/**
 * 批量转换工具集
 */
export function bridgeTools(tools: Record<string, any>) {
  return Object.entries(tools).map(([name, tool]) => bridgeTool(tool, name));
}
