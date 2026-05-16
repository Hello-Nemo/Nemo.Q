import type { AgentIntent, CapabilityDefinition } from './types';

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

// Discovery is intentionally static in Phase 1; the registry contract should settle
// before we add file-system discovery from SKILL.md manifests.
export function listCapabilities(): CapabilityDefinition[] {
  return CAPABILITIES.map((capability) => ({ ...capability }));
}

export function findCapabilitiesForIntent(intent: AgentIntent): CapabilityDefinition[] {
  return CAPABILITIES
    .filter((capability) => capability.intents.includes(intent))
    .map((capability) => ({ ...capability }));
}

export function getCapabilityById(id: string): CapabilityDefinition | undefined {
  const capability = CAPABILITIES.find((item) => item.id === id);
  return capability ? { ...capability } : undefined;
}
