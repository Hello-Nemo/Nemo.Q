'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ShieldCheck, AlertCircle, Clock } from 'lucide-react';
import type { DataAgentUIMessage } from '@/lib/types';
import { getPartArgs, getPartOutput, isExecutionPartType } from '@/lib/chat-utils';
import { getDecisionResolution, isDecisionPartReady } from '@/lib/decision-state';
import type { PreviewExecutionState } from '@/hooks/use-query-execution';
import ReasoningBlock from '@/components/ReasoningBlock';
import DecisionPrompt from '@/components/DecisionPrompt';
import PreviewExecution from './PreviewExecution';

// 动态加载交互组件
const DataTable = dynamic(() => import('@/components/DataTable'), { ssr: false });
const SqlAudit = dynamic(() => import('@/components/SqlAudit'), { ssr: false });
const InsightCard = dynamic(() => import('@/components/InsightCard'), { ssr: false });

interface MessagePartProps {
  /** 当前处理的消息片段 */
  part: DataAgentUIMessage['parts'][number];
  /** 当前片段在列表中的索引 */
  index: number;
  /** 当前消息的所有片段列表 */
  allParts: DataAgentUIMessage['parts'];
  /** 消息在整个对话历史中的索引 */
  messageIndex: number;
  /** 完整消息历史 */
  messages: any[];
  /** 全局加载状态 */
  isLoading: boolean;
  /** 预览计划的执行状态记录 */
  executedPreviews: Record<string, PreviewExecutionState>;
  /** 已固定到画布的卡片数据 */
  pinnedCards: any[];
  /** 固定卡片操作 */
  onPin: (cardData: any) => void;
  /** 数据行操作 */
  onAction: (rowData: any) => void;
  /** 触发预览计划执行 */
  onExecutePreview: (previewKey: string, displayData: any) => void;
}

/**
 * 消息片段分发组件
 * 根据片段类型（文本、推理、工具调用）决定渲染逻辑
 */
export default function MessagePart({
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
}: MessagePartProps) {
  switch (part.type) {
    
    // 1. 普通文本内容渲染
    case 'text':
      if (!part.text?.trim()) return null;
      return (
        <div key={`part-text-${index}`} className="part-unit md-part prose-lumina animate-fade-in">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{part.text}</ReactMarkdown>
        </div>
      );

    // 2. 推理链渲染
    case 'reasoning': {
      const isLastPart = index === (allParts.length - 1);
      const isActive = isLoading && isLastPart;
      
      return (
        <div key={`part-reasoning-${index}`} className="part-unit reasoning-container-wrapper animate-fade-in">
          <ReasoningBlock 
            text={part.text} 
            isActive={isActive} 
          />
        </div>
      );
    }

    // 3. 澄清问题决策渲染
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
                .decision-inline-note {
                  max-width: 760px;
                  border-left: 2px solid rgba(255, 92, 0, 0.45);
                  padding: 4px 0 4px 12px;
                  display: flex;
                  flex-direction: column;
                  gap: 3px;
                }
                .decision-inline-note > span {
                  opacity: 0;
                  animation: note-fade-in 0.5s ease-out forwards;
                }
                .note-title { color: var(--text-tertiary); font-size: 11px; font-weight: 800; animation-delay: 0.1s !important; }
                .note-question { color: var(--text-primary); font-size: 14px; font-weight: 800; line-height: 1.4; animation-delay: 0.6s !important; }
                .note-hint { color: var(--text-secondary); font-size: 12px; animation-delay: 1.2s !important; }
                @keyframes note-fade-in {
                  from { opacity: 0; transform: translateY(2px); }
                  to { opacity: 1; transform: translateY(0); }
                }
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

    // 4. 查询计划预览渲染
    case 'tool-previewQueryPlan': {
      const toolPart = part as any;
      if (!toolPart || !isDecisionPartReady(toolPart)) return null;

      const args = getPartArgs(toolPart);
      const output = getPartOutput(toolPart);
      const displayData = output || args;

      // 如果没有任何实质性内容，且后面还有预览，则跳过当前片段
      const hasMeaningfulPreview = !!(displayData?.sql || displayData?.explanation || displayData?.lineage || displayData?.plan);
      const hasLaterPreview = allParts.slice(index + 1).some((nextPart) => (nextPart as any).type === 'tool-previewQueryPlan');
      if (!hasMeaningfulPreview || (!output && hasLaterPreview)) return null;

      const previewKey = toolPart?.toolCallId || `preview-${index}`;
      const executionState = executedPreviews[previewKey];
      
      // 检查后面是否有正式的执行工具，如果有则当前预览不再展示确认按钮
      const hasDownstreamExecution = allParts.slice(index + 1).some((nextPart) => isExecutionPartType((nextPart as any).type));
      
      const embeddedExecutionState: PreviewExecutionState | undefined = displayData?.executionResult
        ? { status: 'success', result: displayData.executionResult }
        : executionState;

      const isExecuting = executionState?.status === 'loading';
      const isExecuted = executionState?.status === 'success' || !!displayData?.executionResult || output?.requires_action === false;
      const resolution = getDecisionResolution(messages, messageIndex, index);
      
      const promptStatus = isExecuting ? 'executing' : isExecuted ? 'executed' : resolution.status;
      const selectedAnswer = output?.selectedAnswer || resolution.selectedAnswer || (promptStatus === 'executed' ? '确认并执行' : undefined);
      
      return (
        <div key={`part-preview-${index}`} className="part-unit flow-part animate-fade-in">
          <div className="preview-container">
            <div className="preview-label">
              <ShieldCheck size={14} />
              <span>查询计划预览</span>
            </div>
            
            <SqlAudit 
              sql={displayData?.sql} 
              explanation={displayData?.explanation}
              debugRaw={{ output: { audit: { lineage: displayData?.lineage, plan: displayData?.plan } } }}
            />

            <PreviewExecution 
              previewKey={previewKey} 
              state={embeddedExecutionState} 
              onAction={onAction} 
            />

            {!hasDownstreamExecution && promptStatus !== 'pending' && promptStatus !== 'executing' && (
              <DecisionPrompt
                kind="preview"
                question="这个查询计划可以执行吗？"
                context={displayData?.explanation}
                status={promptStatus}
                selectedAnswer={selectedAnswer}
              />
            )}
          </div>
          <style jsx>{`
            .preview-container {
              background: rgba(255, 255, 255, 0.92);
              border: 1px solid var(--surface-border-strong);
              border-left: 3px solid var(--accent-primary);
              border-radius: 8px;
              padding: 20px;
              display: flex;
              flex-direction: column;
              gap: 16px;
              box-shadow: var(--shadow-soft);
            }
            .preview-label { display: flex; align-items: center; gap: 10px; font-family: var(--font-mono); font-size: 11px; font-weight: 800; color: var(--accent-primary); letter-spacing: 0; }
            @media (max-width: 640px) { .preview-container { padding: 16px; } }
          `}</style>
        </div>
      );
    }

    // 5. 正式查询工具渲染
    case 'tool-semanticQuery':
    case 'tool-executeQuery': {
      const toolPart = part as any;
      if (!toolPart) return null;
      const args = getPartArgs(toolPart);
      const output = getPartOutput(toolPart);
      
      const auditData = output?.audit || args;
      const state = toolPart?.state || 'unknown';

      return (
        <div key={`part-query-${index}`} className="part-unit flow-part animate-fade-in">
          <div className="component-container">
            <SqlAudit 
              sql={auditData?.sql || args?.sql} 
              explanation={auditData?.explanation || args?.explanation} 
              assumptions={auditData?.assumptions || args?.assumptions} 
              isStreaming={state === 'call' && !output} 
              debugRaw={toolPart}
            />
            
            <div className={`result-drawer ${output || state === 'output-error' ? 'is-ready' : 'is-loading'}`}>
              {output?.error || toolPart?.errorText ? (
                <div className="error-block soft-surface">
                  <AlertCircle size={16} />
                  <p>{output?.error || toolPart?.errorText}</p>
                </div>
              ) : output?.rows ? (
                <DataTable rows={output.rows} rowCount={output.rowCount} onAction={onAction} />
              ) : (
                <div className="loading-placeholder">
                  <div className="shimmer-table" />
                </div>
              )}
            </div>
            <style jsx>{`
              .component-container { position: relative; display: flex; flex-direction: column; gap: 16px; }
              .result-drawer { border-radius: 14px; overflow: hidden; transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1); }
              .result-drawer.is-loading { opacity: 0.6; filter: grayscale(0.2); }
              .loading-placeholder { height: 200px; background: rgba(0,0,0,0.02); border: 1px dashed var(--surface-border); border-radius: 14px; display: flex; align-items: center; justify-content: center; }
              .shimmer-table { width: 100%; height: 100%; background: linear-gradient(90deg, transparent, rgba(0,0,0,0.03), transparent); animation: shimmer 2s infinite; }
              @keyframes shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
              .error-block { display: flex; align-items: flex-start; gap: 12px; padding: 16px; color: var(--critical); border-radius: 12px; font-size: 13px; font-weight: 600; }
              .error-block p { margin: 0; }
            `}</style>
          </div>
        </div>
      );
    }

    // 6. 辅助工具（Schema 读取等）渲染
    case 'tool-getSchema':
    case 'tool-getTableSamples':
    case 'tool-searchTables':
    case 'tool-listSemanticAtoms': {
      const toolPart = part as any;
      const state = toolPart?.state || 'unknown';
      if (state === 'result') return null; // 结果通常不展示
      
      // 如果前一个片段也是辅助工具，则折叠展示，防止 UI 过于细碎
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

    // 7. 图表渲染工具
    case 'tool-render_chart': {
      const toolPart = part as any;
      if (!toolPart) return null;
      const output = getPartOutput(toolPart);
      if (!output) return <div key={`part-chart-sk-${index}`} className="skeleton-card soft-surface" />;

      const cardId = toolPart?.toolCallId || `chart-${index}`;
      return (
        <div key={`part-chart-${index}`} className="part-unit flow-part animate-fade-in">
          <div className="component-container">
            <InsightCard 
              id={cardId}
              type="chart"
              title={output?.title || '分析图表'}
              description={output?.description}
              data={output?.data || []}
              chartType={output?.type === 'bar' ? 'bar' : 'area'}
              isCertified={output?.audit?.isCertified}
              audit={output?.audit}
              isPinned={pinnedCards.some(c => c.id === cardId)}
              onPin={() => onPin({
                id: cardId,
                type: 'chart',
                title: output?.title,
                data: output?.data,
                chartType: output?.type === 'bar' ? 'bar' : 'area',
              })}
            />
          </div>
          <style jsx>{`
            .component-container { position: relative; display: flex; flex-direction: column; gap: 16px; }
            .skeleton-card { height: 240px; border-radius: 24px; background: rgba(0,0,0,0.02); animation: pulse 2s infinite; }
            @keyframes pulse { 0% { opacity: 0.6; } 50% { opacity: 1; } 100% { opacity: 0.6; } }
          `}</style>
        </div>
      );
    }

    // 8. 洞察画布生成渲染
    case 'tool-generateInsightCanvas': {
      const toolPart = part as any;
      if (!toolPart) return null;
      const output = getPartOutput(toolPart);
      const cards = output?.cards || getPartArgs(toolPart)?.cards || [];
      if (!cards.length) return <div key={`part-canvas-sk-${index}`} className="skeleton-card soft-surface" />;

      return (
        <div key={`part-canvas-${index}`} className="part-unit flow-part animate-fade-in">
          <div className="insight-grid">
            {cards.map((card: any, cardIdx: number) => (
              <InsightCard
                key={card.id || `${toolPart?.toolCallId || 'canvas'}-${cardIdx}`}
                id={card.id || `${toolPart?.toolCallId || 'canvas'}-${cardIdx}`}
                type={card.type}
                title={card.title}
                description={card.explanation}
                data={card.data || []}
                chartType={card.chartType || 'bar'}
                config={card.config}
                compact={card.type !== 'table'}
                isPinned={pinnedCards.some(c => c.id === (card.id || `${toolPart?.toolCallId || 'canvas'}-${cardIdx}`))}
                onPin={() => onPin(card)}
              />
            ))}
          </div>
          <style jsx>{`
            .insight-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; }
            .skeleton-card { height: 240px; border-radius: 24px; background: rgba(0,0,0,0.02); animation: pulse 2s infinite; }
          `}</style>
        </div>
      );
    }

    default: return null;
  }
}
