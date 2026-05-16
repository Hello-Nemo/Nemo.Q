import assert from 'node:assert/strict';
import test from 'node:test';

import { toAgentRunDataPart } from '@/lib/agent/adapter/stream-protocol-adapter';
import type { AgentTraceEvent } from '@/lib/agent/orchestrator/types';

test('stream adapter wraps agent trace events in a stable data part', () => {
  const event: AgentTraceEvent = {
    type: 'capability_selected',
    payload: { capabilityIds: ['nemo-q'] },
  };

  assert.deepEqual(toAgentRunDataPart(event), {
    type: 'data-agent-run',
    data: event,
  });
});
