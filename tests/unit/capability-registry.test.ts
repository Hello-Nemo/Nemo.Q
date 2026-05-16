import assert from 'node:assert/strict';
import test from 'node:test';

import {
  findCapabilitiesForIntent,
  getCapabilityById,
  listCapabilities,
} from '@/lib/agent/orchestrator/registry';

test('registry exposes nemo-q as the first data-analysis capability', () => {
  const capabilities = listCapabilities();

  assert.equal(capabilities.length, 1);
  assert.deepEqual(capabilities[0], {
    id: 'nemo-q',
    name: 'Nemo.Q',
    description: 'Semantic data analysis capability backed by the nemo-q skill.',
    domains: ['data-analysis', 'sql', 'semantic-query'],
    intents: ['analyze', 'clarify'],
    risk: 'medium',
    cost: 'medium',
  });
});

test('registry finds capabilities by intent and id', () => {
  assert.deepEqual(findCapabilitiesForIntent('analyze').map((capability) => capability.id), ['nemo-q']);
  assert.equal(getCapabilityById('nemo-q')?.name, 'Nemo.Q');
  assert.equal(getCapabilityById('missing'), undefined);
});
