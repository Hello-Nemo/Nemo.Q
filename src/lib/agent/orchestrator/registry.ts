import type { AgentIntent, CapabilityDefinition } from './types';

/**
 * Phase 1 的能力注册表。
 *
 * 现在先用静态声明把“能力协议”定稳，避免一开始就把复杂度放在自动发现上。
 * 等第二个、第三个真实能力接入后，再把这里演进成从 manifest 自动装载。
 */
const CAPABILITIES: CapabilityDefinition[] = [
  {
    id: 'nemo-q',
    name: 'Nemo.Q',
    description: 'Semantic data analysis capability backed by the nemo-q skill.',
    domains: ['data-analysis', 'sql', 'semantic-query'],
    intents: ['analyze', 'clarify'],
    risk: 'medium',
    cost: 'medium',
  },
];

/**
 * 列出当前可用能力。
 *
 * 返回副本而不是原数组，避免调用方误改注册表内部状态。
 */
export function listCapabilities(): CapabilityDefinition[] {
  return CAPABILITIES.map((capability) => ({ ...capability }));
}

/** 根据高层意图筛选可用能力，例如 `analyze -> nemo-q`。 */
export function findCapabilitiesForIntent(intent: AgentIntent): CapabilityDefinition[] {
  return CAPABILITIES
    .filter((capability) => capability.intents.includes(intent))
    .map((capability) => ({ ...capability }));
}

/** 根据能力 ID 做精确查找，便于运行时或 UI 获取能力详情。 */
export function getCapabilityById(id: string): CapabilityDefinition | undefined {
  const capability = CAPABILITIES.find((item) => item.id === id);
  return capability ? { ...capability } : undefined;
}
