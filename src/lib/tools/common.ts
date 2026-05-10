import { tool } from 'ai';
import { z } from 'zod';

/**
 * 框架级通用工具：请求澄清
 * 用于在任务执行过程中遇到歧义时，暂停 Agent 循环并弹出 UI 选项让用户选择。
 */
export const askClarification = tool({
  description: '【最高优先级工具】。当用户请求存在歧义、口径不一致或需要从多个预设选项中做决定时，必须调用此工具。调用后任务会暂停，UI 将展示选项供用户点击确认。',
  inputSchema: z.object({
    question: z.string().describe('需要用户澄清的具体问题'),
    options: z.array(z.object({
      label: z.string().describe('选项显示的文本（如："按日环比"）'),
      value: z.string().describe('选中该选项后代表的业务定义（如："daily_growth"）'),
      description: z.string().optional().describe('选项的详细说明'),
    })).describe('预设的结构化备选选项，方便用户直接点击'),
    recommendedOptionValue: z.string().optional().describe('可选。若某个选项是推荐默认路径，填写该选项的 value。'),
    context: z.string().optional().describe('产生歧义的业务背景或逻辑冲突描述'),
  }),
  execute: async (args) => {
    // 返回结果中带有 requires_action: true，adapter 会将其识别并触发前端 UI
    return { ...args, requires_action: true };
  },
});

export const commonTools = {
  askClarification,
};
