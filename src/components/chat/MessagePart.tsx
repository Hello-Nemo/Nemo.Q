'use client';

import React, { useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { ShieldCheck, AlertCircle, Clock, Sparkles } from 'lucide-react';
import type { DataAgentUIMessage } from '@/lib/types';
import { getPartArgs, getPartOutput, isExecutionPartType } from '@/lib/chat-utils';
import { getDecisionResolution, isDecisionPartReady } from '@/lib/decision-state';
import type { PreviewExecutionState } from '@/hooks/use-query-execution';
import ReasoningBlock from '@/components/ReasoningBlock';
import DecisionPrompt from '@/components/DecisionPrompt';
import PreviewExecution from './PreviewExecution';
import DataTable from '@/components/DataTable';
import SqlAudit from '@/components/SqlAudit';
import InsightCard from '@/components/InsightCard';
import AgentReasoningPipeline from '@/components/AgentReasoningPipeline';
import {
  buildLatestAgentRunViewModel,
  isLatestAgentRunPart,
} from '@/lib/chat-utils';

// 定义稳定的常量以避免 React 死循环
const EMPTY_ARRAY: any[] = [];
const EMPTY_OBJECT = {};

/**
 * 查询结果片段组件 - 独立子组件，安全使用 Hook
 */
const QueryPart = React.memo(({ toolPart, onAction, args }: any) => {
  const output = getPartOutput(toolPart);
  
  const effectiveOutput = useMemo(() => {
    return output?.data || output || EMPTY_OBJECT;
  }, [output]);

  const auditData = useMemo(() => {
    return effectiveOutput?.audit || args;
  }, [effectiveOutput, args]);

  const state = toolPart?.state || 'unknown';

  return (
    <div className="part-unit flow-part animate-fade-in">
      <div className="component-container">
        <SqlAudit 
          sql={auditData?.sql || args?.sql} 
          explanation={auditData?.explanation || args?.explanation} 
          assumptions={auditData?.assumptions || args?.assumptions} 
          isStreaming={state === 'call' && !output} 
          debugRaw={toolPart}
        />
        
        <div className={`result-drawer ${output || state === 'output-error' ? 'is-ready' : 'is-loading'}`}>
          {effectiveOutput?.error || toolPart?.errorText ? (
            <div className="error-block soft-surface">
              <AlertCircle size={16} />
              <p>{effectiveOutput?.error || toolPart?.errorText}</p>
            </div>
          ) : effectiveOutput?.rows ? (
            <DataTable rows={effectiveOutput.rows} rowCount={effectiveOutput.rowCount} onAction={onAction} />
          ) : (
            <div className="loading-placeholder">
              <div className="shimmer-table" />
            </div>
          )}
        </div>
      </div>
      <style jsx>{`
        .component-container { position: relative; display: flex; flex-direction: column; gap: 16px; }
        .result-drawer { border-radius: 14px; overflow: hidden; transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1); }
        .result-drawer.is-loading { opacity: 0.6; filter: grayscale(0.2); }
        .loading-placeholder { min-height: 240px; background: rgba(0,0,0,0.02); border: 1px dashed var(--surface-border); border-radius: 14px; display: flex; align-items: center; justify-content: center; }
        .shimmer-table { width: 100%; height: 100%; background: linear-gradient(90deg, transparent, rgba(0,0,0,0.03), transparent); animation: shimmer 2s infinite; }
        @keyframes shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
        .error-block { display: flex; align-items: flex-start; gap: 12px; padding: 16px; color: var(--critical); border-radius: 12px; font-size: 13px; font-weight: 600; }
        .error-block p { margin: 0; }
      `}</style>
    </div>
  );
});

/**
 * 图表结果片段组件 - 独立子组件，安全使用 Hook
 */
const ChartPart = React.memo(({ toolPart, index, pinnedCards, onPin, args }: any) => {
  const output = getPartOutput(toolPart);
  
  const chartDef = useMemo(() => {
    return output?.def || output?.data || output || args?.def || args?.data || args;
  }, [output, args]);

  const chartData = useMemo(() => {
    return chartDef?.data || EMPTY_ARRAY;
  }, [chartDef]);

  const chartConfig = useMemo(() => ({
    xAxis: chartDef?.xAxisKey,
    yAxis: chartDef?.yAxisKey,
  }), [chartDef?.xAxisKey, chartDef?.yAxisKey]);

  // 处理固定操作的回调
  const handlePinClick = useCallback(() => {
    if (!chartDef) return;
    onPin({
      id: toolPart?.toolCallId || `chart-${index}`,
      type: 'chart',
      title: chartDef?.title,
      config: chartConfig,
      data: chartData,
      chartType: chartDef?.type === 'bar' ? 'bar' : 'area',
    });
  }, [onPin, toolPart?.toolCallId, index, chartDef, chartConfig, chartData]);

  const state = toolPart?.state || 'unknown';
  const isExecuting = state === 'call' || state === 'streaming';
  
  // 如果没有数据且正在执行，展示更有动感的加载态
  if ((!chartData || chartData.length === 0) && isExecuting) {
    return (
      <div className="part-unit flow-part animate-fade-in">
        <div className="skeleton-container soft-surface">
          <Clock size={16} className="spin-slow text-accent" />
          <span>NEMO.Q 正在构建分析模型与可视化看板...</span>
        </div>
        <style jsx>{`
          .skeleton-container { 
            height: 280px; border-radius: 24px; background: rgba(0,0,0,0.01); 
            display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px;
            border: 1px dashed rgba(0,0,0,0.05); font-size: 13px; color: var(--text-tertiary);
          }
          .spin-slow { animation: spin 3s linear infinite; }
          @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        `}</style>
      </div>
    );
  }

  const cardId = toolPart?.toolCallId || `chart-${index}`;
  return (
    <div className="part-unit flow-part animate-fade-in">
      <div className="component-container">
        <InsightCard 
          id={cardId}
          type="chart"
          title={chartDef?.title || '分析图表'}
          description={chartDef?.description}
          data={chartData}
          chartType={chartDef?.type === 'bar' ? 'bar' : 'area'}
          config={chartConfig}
          isCertified={chartDef?.audit?.isCertified}
          audit={chartDef?.audit}
          isPinned={pinnedCards.some((c: any) => c.id === cardId)}
          onPin={handlePinClick}
        />
      </div>
      <style jsx>{`
        .component-container { position: relative; display: flex; flex-direction: column; gap: 16px; }
      `}</style>
    </div>
  );
});

interface MessagePartProps {
  part: DataAgentUIMessage['parts'][number];
  index: number;
  allParts: DataAgentUIMessage['parts'];
  messageIndex: number;
  messages: any[];
  isLoading: boolean;
  executedPreviews: Record<string, PreviewExecutionState>;
  pinnedCards: any[];
  onPin: (cardData: any) => void;
  onAction: (action: any) => void;
  onExecutePreview: (previewKey: string, displayData: any) => void;
}

const MessagePart = React.memo(({
  part,
  index,
  allParts,
  messageIndex,
  messages,
  isLoading,
  executedPreviews,
  pinnedCards,
  onPin,
  onAction,
  onExecutePreview
}: MessagePartProps) => {
  switch (part.type) {
    case 'text':
      if (!part.text?.trim()) return null;
      return (
        <div key={`part-text-${index}`} className="part-unit md-part prose-lumina animate-fade-in">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{part.text}</ReactMarkdown>
        </div>
      );

    case 'reasoning': {
      const isLastPart = index === (allParts.length - 1);
      const isActive = isLoading && isLastPart;
      return (
        <div key={`part-reasoning-${index}`} className="part-unit reasoning-container-wrapper animate-fade-in">
          <ReasoningBlock text={part.text} isActive={isActive} />
        </div>
      );
    }

    case 'data-agent-run': {
      if (!isLatestAgentRunPart(allParts, index)) return null;
      const runViewModel = buildLatestAgentRunViewModel(allParts);
      if (!runViewModel) return null;

      return (
        <div key={`part-agent-run-${index}`} className="part-unit flow-part animate-fade-in">
          <AgentReasoningPipeline
            goal={runViewModel.goal}
            selectedCapabilityIds={runViewModel.selectedCapabilityIds}
            status={runViewModel.status}
            steps={runViewModel.steps}
          />
        </div>
      );
    }

    case 'tool-askClarification': {
      const toolPart = part as any;
      if (!isDecisionPartReady(toolPart)) return null;
      const args = getPartArgs(toolPart);
      const resolution = getDecisionResolution(messages, messageIndex, index);
      
      return (
        <div key={`part-clarification-${index}`} className="part-unit flow-part animate-fade-in">
          {resolution.status === 'pending' ? (
            <div className="decision-inline-note">
              <span className="note-title">需要确认</span>
              <span className="note-question">{args.question || '请问如何继续？'}</span>
              <span className="note-hint">请在下方输入框选择选项或补充信息。</span>
              <style jsx>{`
                .decision-inline-note { border-left: 2px solid rgba(255, 92, 0, 0.45); padding: 4px 0 4px 12px; display: flex; flex-direction: column; gap: 3px; }
                .note-title { color: var(--text-tertiary); font-size: 11px; font-weight: 800; }
                .note-question { color: var(--text-primary); font-size: 14px; font-weight: 800; line-height: 1.4; }
                .note-hint { color: var(--text-secondary); font-size: 12px; }
              `}</style>
            </div>
          ) : (
            <DecisionPrompt
              kind="clarification"
              question={args.question || '请问如何继续？'}
              context={args.context || ''}
              status={resolution.status}
              selectedAnswer={resolution.selectedAnswer}
            />
          )}
        </div>
      );
    }

    case 'tool-previewQueryPlan': {
      const toolPart = part as any;
      if (!toolPart || !isDecisionPartReady(toolPart)) return null;
      const args = getPartArgs(toolPart);
      const output = getPartOutput(toolPart);
      const displayData = output || args;

      const hasMeaningfulPreview = !!(displayData?.sql || displayData?.explanation || displayData?.lineage || displayData?.plan);
      const hasLaterPreview = allParts.slice(index + 1).some((nextPart) => (nextPart as any).type === 'tool-previewQueryPlan');
      if (!hasMeaningfulPreview || (!output && hasLaterPreview)) return null;

      const previewKey = toolPart?.toolCallId || `preview-${index}`;
      const embeddedExecutionState: PreviewExecutionState | undefined = displayData?.executionResult
        ? { status: 'success', result: displayData.executionResult }
        : executedPreviews[previewKey];

      const isExecuted = !!displayData?.executionResult || output?.requires_action === false || executedPreviews[previewKey]?.status === 'success';
      const resolution = getDecisionResolution(messages, messageIndex, index);
      const promptStatus = executedPreviews[previewKey]?.status === 'loading' ? 'executing' : isExecuted ? 'executed' : resolution.status;
      const selectedAnswer = output?.selectedAnswer || resolution.selectedAnswer || (promptStatus === 'executed' ? '确认并执行' : undefined);
      
      return (
        <div key={`part-preview-${index}`} className="part-unit flow-part animate-fade-in">
          <div className="preview-container">
            <div className="preview-label">
              <ShieldCheck size={14} />
              <span>查询计划预览</span>
            </div>
            <SqlAudit sql={displayData?.sql} explanation={displayData?.explanation} debugRaw={{ output: { audit: { lineage: displayData?.lineage, plan: displayData?.plan } } }} />
            <PreviewExecution previewKey={previewKey} state={embeddedExecutionState} onAction={onAction} />
            {promptStatus !== 'pending' && promptStatus !== 'executing' && (
              <DecisionPrompt kind="preview" question="这个查询计划可以执行吗？" context={displayData?.explanation} status={promptStatus} selectedAnswer={selectedAnswer} />
            )}
          </div>
          <style jsx>{`
            .preview-container { background: rgba(255, 255, 255, 0.92); border: 1px solid var(--surface-border-strong); border-left: 3px solid var(--accent-primary); border-radius: 8px; padding: 20px; display: flex; flex-direction: column; gap: 16px; box-shadow: var(--shadow-soft); }
            .preview-label { display: flex; align-items: center; gap: 10px; font-family: var(--font-mono); font-size: 11px; font-weight: 800; color: var(--accent-primary); }
          `}</style>
        </div>
      );
    }

    case 'tool-semanticQuery':
    case 'tool-executeQuery':
      return <QueryPart key={`query-${index}`} toolPart={part} onAction={onAction} args={getPartArgs(part as any)} />;

    case 'tool-getSchema':
    case 'tool-getTableSamples':
    case 'tool-searchTables':
    case 'tool-listSemanticAtoms': {
      const toolPart = part as any;
      const state = toolPart?.state || 'unknown';
      if (state === 'result') return null;
      const previousPart = allParts[index - 1] as any;
      const previousWasUtility = previousPart && ['tool-getSchema', 'tool-getTableSamples', 'tool-searchTables', 'tool-listSemanticAtoms'].includes(previousPart.type);
      if (previousWasUtility) return null;
      return (
        <div key={`part-util-${index}`} className="part-unit util-part animate-fade-in">
          <div className="util-indicator">
            <Clock size={12} className="spin-slow" />
            <span>正在读取库表、样本与语义资产...</span>
          </div>
          <style jsx>{`
            .util-indicator { display: flex; align-items: center; gap: 8px; padding: 8px 16px; background: rgba(0,0,0,0.03); border-radius: 8px; font-size: 11px; color: var(--text-tertiary); margin: 4px 0; }
            .spin-slow { animation: spin 3s linear infinite; }
            @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
          `}</style>
        </div>
      );
    }

    case 'tool-render_chart':
      return <ChartPart key={`chart-${index}`} toolPart={part} index={index} pinnedCards={pinnedCards} onPin={onPin} args={getPartArgs(part as any)} />;

    case 'tool-showInsight': {
      const args = getPartArgs(part as any);
      return (
        <div key={`part-insight-${index}`} className="part-unit insight-part animate-fade-in">
          <div className="insight-simple-card soft-surface">
            <Sparkles size={16} className="text-accent" />
            <p>{args.insight || args.message}</p>
          </div>
          <style jsx>{`
            .insight-simple-card { display: flex; align-items: flex-start; gap: 12px; padding: 16px; border-radius: 16px; background: linear-gradient(135deg, rgba(255,92,0,0.05) 0%, rgba(255,255,255,0.05) 100%); border: 1px solid rgba(255,92,0,0.1); }
            .insight-simple-card p { margin: 0; font-size: 14px; color: var(--text-primary); font-weight: 500; }
          `}</style>
        </div>
      );
    }

    default: return null;
  }
}, (prevProps, nextProps) => {
  // 自定义比较逻辑：只有当关键属性发生变化时才允许重绘
  if (prevProps.isLoading !== nextProps.isLoading) return false;
  if (prevProps.index !== nextProps.index) return false;
  if (prevProps.pinnedCards.length !== nextProps.pinnedCards.length) return false;
  
  const p = prevProps.part as any;
  const n = nextProps.part as any;
  
  if (p.type !== n.type) return false;
  if (p.state !== n.state) return false;
  
  if (p.type === 'text') {
    return p.text === n.text;
  }

  if (p.type === 'data-agent-run') {
    return p.data === n.data;
  }
  
  if (p.toolCallId !== n.toolCallId) return false;
  
  if (p.type === 'tool-previewQueryPlan') {
    const pKey = p.toolCallId || `preview-${prevProps.index}`;
    const nKey = n.toolCallId || `preview-${nextProps.index}`;
    if (prevProps.executedPreviews[pKey] !== nextProps.executedPreviews[nKey]) return false;
  }

  return true;
});

export default MessagePart;
