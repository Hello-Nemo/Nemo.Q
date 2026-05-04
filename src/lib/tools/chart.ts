import { tool } from 'ai';
import { z } from 'zod';

/**
 * 图表渲染工具
 * 这是一个 UI 工具，Agent 调用它来建议前端渲染特定的图表。
 */
export const chartTools = {
  render_chart: tool({
    description: '根据数据渲染可视化图表。当用户需要分析趋势、对比或比例时使用。',
    inputSchema: z.object({
      type: z.enum(['line', 'bar', 'pie']).describe('图表类型：折线图、柱状图或饼图'),
      title: z.string().describe('图表标题'),
      description: z.string().optional().describe('图表的简短描述或洞察'),
      data: z.array(z.record(z.string(), z.any())).describe('图表数据数组，例如 [{name: "Jan", value: 100}]'),
      xAxisKey: z.string().describe('X 轴对应的键名（饼图通常不需要）'),
      yAxisKey: z.string().describe('Y 轴对应的键名'),
      audit: z.any().optional().describe('可选的审计信息，包含 SQL 和业务假设'),
    }),
    execute: async (args) => {
      // 这是一个展示类工具，服务端不需要逻辑，直接返回参数供前端渲染
      return { success: true, ...args };
    },
  }),
};
