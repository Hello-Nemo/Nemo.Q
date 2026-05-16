import type {
  AgentPlan,
  AgentPlanStep,
  CapabilityDefinition,
} from './types';

/**
 * Phase 1 先用轻量规则做规划。
 *
 * 这里的目标不是一次性造出通用语义理解器，
 * 而是先把“什么时候直接答、什么时候澄清、什么时候进入多步分析”
 * 这三个最重要的路径分开。
 */
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

/** 这些表达过于宽泛，先澄清再执行比盲目分析更可靠。 */
const AMBIGUOUS_DATA_PATTERNS = [
  /看看数据/,
  /分析一下数据/,
  /看下数据/,
];

/** 粗粒度判断当前请求是否像数据分析任务。 */
function isDataAnalysisRequest(request: string): boolean {
  return DATA_ANALYSIS_KEYWORDS.some((keyword) => request.includes(keyword));
}

/** 判断请求是否只表达了“想看数据”，却没给出足够分析目标。 */
function isAmbiguousDataRequest(request: string): boolean {
  return AMBIGUOUS_DATA_PATTERNS.some((pattern) => pattern.test(request));
}

/** 统一构造步骤，避免不同分支手写出风格不一致的计划对象。 */
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

/**
 * 把用户请求转换成结构化计划。
 *
 * 这里暂时把意图识别和计划生成放在同一层：
 * - 简单问答：直接回答
 * - 模糊分析：先澄清
 * - 明确分析：走“理解 -> 委派 -> 汇总”三步
 *
 * 等未来出现第二个调用方或更复杂路由，再把 intent analyzer 单独拆出去。
 */
export function createPlan(request: string, capabilities: CapabilityDefinition[]): AgentPlan {
  const dataCapabilities = capabilities.filter((capability) => capability.intents.includes('analyze'));
  const selectedCapabilityIds = dataCapabilities.map((capability) => capability.id);

  // 模糊请求优先进入澄清分支，避免 Agent 在缺少目标时自行脑补。
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

  // 明确的数据分析任务，进入最小的三步编排闭环。
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

  // 其余请求在 Phase 1 先按“无需工具的直接回答”处理。
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
