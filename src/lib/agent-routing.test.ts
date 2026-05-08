import { describe, expect, it } from 'vitest';
import {
  getActiveToolsForAgentStep,
  getLatestUserTextFromModelMessages,
} from './agent-routing';

describe('agent routing', () => {
  it('keeps standard semantic questions on a narrow tool set', () => {
    const activeTools = getActiveToolsForAgentStep({
      latestUserText: '对比今年和去年各月的销售额',
      steps: [],
    });

    expect(activeTools).toEqual([
      'semanticQuery',
      'previewQueryPlan',
      'askClarification',
      'render_chart',
    ]);
  });

  it('allows semantic recovery tools after semantic compilation errors', () => {
    const activeTools = getActiveToolsForAgentStep({
      latestUserText: '查询毛利率',
      steps: [{
        toolResults: [{
          result: { code: 'SEMANTIC_COMPILATION_FAILED' },
        }],
      }],
    });

    expect(activeTools).toContain('listSemanticAtoms');
    expect(activeTools).toContain('askClarification');
    expect(activeTools).toContain('semanticQuery');
  });

  it('keeps exploration tools for non-semantic questions', () => {
    const activeTools = getActiveToolsForAgentStep({
      latestUserText: '随机抽样看看 orders 表里的数据格式',
      steps: [],
    });

    expect(activeTools).toContain('getSchema');
    expect(activeTools).toContain('getTableSamples');
    expect(activeTools).toContain('executeQuery');
  });

  it('extracts latest user text from model messages', () => {
    const text = getLatestUserTextFromModelMessages([
      { role: 'user', content: [{ type: 'text', text: '旧问题' }] },
      { role: 'assistant', content: [{ type: 'text', text: '旧回答' }] },
      { role: 'user', content: [{ type: 'text', text: '今年销售额' }] },
    ] as any);

    expect(text).toBe('今年销售额');
  });
});
