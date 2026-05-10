/**
 * 聊天界面相关的常量配置
 */

/**
 * 欢迎界面展示的建议问题列表
 */
export const SUGGESTED_QUESTIONS = [
  "分析各国家的销售额和客单价",
  "分析各月份的销售额与订单趋势",
  "分析核心忠诚客户的表现",
  "找出最近退货率最高的产品类别",
];

/**
 * 定义哪些工具类型属于“执行类”工具
 * 用于判断是否需要在预览后展示执行结果
 */
export const EXECUTION_TOOL_TYPES = new Set([
  'tool-semanticQuery',
  'tool-executeQuery',
  'tool-render_chart',
  'tool-generateInsightCanvas',
]);

/**
 * 数据库字段名与中文标签的映射表
 * 用于图表和表格的友好展示
 */
export const COLUMN_LABELS: Record<string, string> = {
  user_country: '国家',
  country: '国家',
  sales_amount: '销售额',
  aov: '客单价',
  order_count: '订单量',
  user_count: '用户数',
  return_amount: '退货金额',
};
