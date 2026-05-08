export const semanticFastTools = [
  'semanticQuery',
  'previewQueryPlan',
  'askClarification',
  'render_chart',
  'executeQuery',
] as const;

export const semanticRecoveryTools = [
  'listSemanticAtoms',
  'semanticQuery',
  'previewQueryPlan',
  'askClarification',
  'render_chart',
  'executeQuery',
] as const;

export const analysisTools = [
  'analysisQuery',
  'semanticQuery',
  'previewQueryPlan',
  'askClarification',
  'render_chart',
] as const;

export const exploratoryTools = [
  'getSchema',
  'getTableSamples',
  'searchTables',
  'executeQuery',
  'listSemanticAtoms',
  'askClarification',
  'semanticQuery',
  'analysisQuery',
  'previewQueryPlan',
  'render_chart',
] as const;

const semanticIntentPattern =
  /(销售额|销售|订单量|订单数|客单价|退货金额|退货|用户数|国家|品类|类别|年龄段|各月|按月|月度|今年|去年|上个月|本月|同比|环比|趋势|排名|最高|最低|对比)/i;

const analysisIntentPattern =
  /(留存|漏斗|cohort|同期群|路径|序列|转化)/i;

const exploratoryIntentPattern =
  /(抽样|样本|schema|表结构|字段|数据库结构|看看.*表|原始数据|明细|随便查|探索 SQL|手写 SQL)/i;

const semanticFailureCodes = new Set([
  'SEMANTIC_COMPILATION_FAILED',
  'ANALYSIS_COMPILATION_FAILED',
  'SEMANTIC_COVERAGE_REQUIRED',
]);

type AgentStepLike = {
  toolResults?: Array<Record<string, unknown>>;
};

function hasSemanticFailure(steps: AgentStepLike[]): boolean {
  return steps.some(step => step.toolResults?.some(toolResult => {
    const result = (toolResult.result ?? toolResult.output) as { code?: string } | undefined;
    return !!result?.code && semanticFailureCodes.has(result.code);
  }));
}

function contentPartToText(part: any): string {
  if (typeof part === 'string') return part;
  if (part?.type === 'text') return part.text || '';
  return '';
}

export function getLatestUserTextFromModelMessages(messages: any[]): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role !== 'user') continue;

    if (typeof message.content === 'string') return message.content;
    if (Array.isArray(message.content)) {
      return message.content.map(contentPartToText).join('\n').trim();
    }
    if (Array.isArray(message.parts)) {
      return message.parts.map(contentPartToText).join('\n').trim();
    }
  }

  return '';
}

export function getActiveToolsForAgentStep(args: {
  latestUserText: string;
  steps: AgentStepLike[];
}) {
  if (hasSemanticFailure(args.steps)) {
    return [...semanticRecoveryTools];
  }

  if (analysisIntentPattern.test(args.latestUserText)) {
    return [...analysisTools];
  }

  if (
    exploratoryIntentPattern.test(args.latestUserText) &&
    !semanticIntentPattern.test(args.latestUserText)
  ) {
    return [...exploratoryTools];
  }

  if (semanticIntentPattern.test(args.latestUserText)) {
    return [...semanticFastTools];
  }

  return [...exploratoryTools];
}
