import type {
  AgentPlan,
  AgentPlanStep,
  CapabilityDefinition,
} from './types';

const DATA_ANALYSIS_KEYWORDS = [
  '分析',
  '销售额',
  '订单',
  '退货',
  '客单价',
  '统计',
  '查询',
  '数据',
];

const AMBIGUOUS_DATA_PATTERNS = [
  /看看数据/,
  /分析一下数据/,
  /看下数据/,
];

function isDataAnalysisRequest(request: string): boolean {
  return DATA_ANALYSIS_KEYWORDS.some((keyword) => request.includes(keyword));
}

function isAmbiguousDataRequest(request: string): boolean {
  return AMBIGUOUS_DATA_PATTERNS.some((pattern) => pattern.test(request));
}

function buildStep(
  id: string,
  title: string,
  objective: string,
  executionMode: AgentPlanStep['executionMode'],
  expectedOutput: string,
  requiredCapabilityIds: string[] = []
): AgentPlanStep {
  return {
    id,
    title,
    objective,
    executionMode,
    expectedOutput,
    requiredCapabilityIds,
    status: 'pending',
  };
}

export function createPlan(request: string, capabilities: CapabilityDefinition[]): AgentPlan {
  const dataCapabilities = capabilities.filter((capability) => capability.intents.includes('analyze'));
  const selectedCapabilityIds = dataCapabilities.map((capability) => capability.id);

  if (isAmbiguousDataRequest(request)) {
    return {
      goal: request,
      primaryIntent: 'clarify',
      complexity: 'simple',
      selectedCapabilityIds,
      needsClarification: true,
      steps: [
        buildStep(
          'clarify-analysis-goal',
          '澄清分析目标',
          '补齐要分析的指标、维度或时间范围',
          'self',
          '用户确认后的明确分析目标'
        ),
      ],
    };
  }

  if (isDataAnalysisRequest(request) && selectedCapabilityIds.length > 0) {
    return {
      goal: request,
      primaryIntent: 'analyze',
      complexity: 'multi_step',
      selectedCapabilityIds,
      needsClarification: false,
      steps: [
        buildStep(
          'understand-analysis-goal',
          '识别分析目标',
          '提取指标、维度和时间范围',
          'self',
          '结构化分析目标'
        ),
        buildStep(
          'delegate-analysis',
          '委派数据分析',
          '调用最合适的数据分析能力执行任务',
          'skill',
          '分析结果与审计信息',
          selectedCapabilityIds
        ),
        buildStep(
          'synthesize-insight',
          '整理结论',
          '汇总结果并形成最终回答',
          'self',
          '面向用户的洞察总结'
        ),
      ],
    };
  }

  return {
    goal: request,
    primaryIntent: 'answer',
    complexity: 'simple',
    selectedCapabilityIds: [],
    needsClarification: false,
    steps: [
      buildStep(
        'answer-directly',
        '直接回答',
        '直接生成对用户问题的回复',
        'self',
        '自然语言回答'
      ),
    ],
  };
}
