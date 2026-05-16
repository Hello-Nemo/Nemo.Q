import fs from 'node:fs';
import path from 'node:path';
import { createPlan } from '../src/lib/agent/orchestrator/planner';
import { listCapabilities } from '../src/lib/agent/orchestrator/registry';
import { scoreAgentPlan, type AgentEvalCase } from '../src/lib/agent/orchestrator/eval';

const datasetPath = path.join(process.cwd(), 'tests/eval/super-agent-dataset.json');
const dataset = JSON.parse(fs.readFileSync(datasetPath, 'utf8')) as AgentEvalCase[];

const results = dataset.map((testCase) => {
  const plan = createPlan(testCase.request, listCapabilities());
  return {
    id: testCase.id,
    ...scoreAgentPlan(testCase, plan),
  };
});

const passedCount = results.filter((result) => result.passed).length;

console.log(JSON.stringify({
  total: results.length,
  passed: passedCount,
  failed: results.length - passedCount,
  results,
}, null, 2));

if (passedCount !== results.length) {
  process.exitCode = 1;
}
