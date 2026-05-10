'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { buildChartSpecs } from '@/lib/chat-utils';
import type { PreviewExecutionState } from '@/hooks/use-query-execution';

// 动态导入重型组件，提升首屏加载速度
const DataTable = dynamic(() => import('@/components/DataTable'), { ssr: false });
const InsightCard = dynamic(() => import('@/components/InsightCard'), { ssr: false });

interface PreviewExecutionProps {
  /**
   * 关联的工具调用 ID
   */
  previewKey: string;
  /**
   * 执行状态对象
   */
  state?: PreviewExecutionState;
  /**
   * 结果行操作回调
   */
  onAction: (rowData: any) => void;
}

/**
 * 预览计划执行结果展示组件
 * 根据不同的执行状态（加载中、成功、失败）展示相应的 UI
 */
export default function PreviewExecution({ previewKey, state, onAction }: PreviewExecutionProps) {
  if (!state) return null;

  // 1. 加载中状态
  if (state.status === 'loading') {
    return (
      <div className="preview-execution execution-loading">
        <Loader2 size={16} className="spin-slow" />
        <span>正在执行已确认的查询计划...</span>
        <style jsx>{`
          .preview-execution {
            border-radius: 14px;
            border: 1px solid var(--surface-border);
            background: #FFFFFF;
          }
          .execution-loading {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 14px 16px;
            font-size: 13px;
            font-weight: 700;
            color: var(--text-secondary);
          }
          .spin-slow { animation: spin 1s linear infinite; }
          @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        `}</style>
      </div>
    );
  }

  // 2. 执行失败状态
  if (state.status === 'error') {
    return (
      <div className="preview-execution execution-error">
        <AlertCircle size={16} />
        <span>{state.error || '查询执行失败'}</span>
        <style jsx>{`
          .preview-execution {
            border-radius: 14px;
            border: 1px solid var(--surface-border);
            background: #FFFFFF;
          }
          .execution-error {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 14px 16px;
            font-size: 13px;
            font-weight: 700;
            border-color: rgba(239, 68, 68, 0.2);
            color: var(--critical);
            background: rgba(239, 68, 68, 0.04);
          }
        `}</style>
      </div>
    );
  }

  // 3. 执行成功状态
  const rows = state.result?.rows || [];
  const chartSpecs = buildChartSpecs(rows);

  return (
    <div className="preview-execution execution-ready">
      {/* 头部信息 */}
      <div className="execution-head">
        <div className="execution-title">
          <CheckCircle2 size={16} />
          <span>已执行查询计划</span>
        </div>
        <span className="execution-count">{state.result?.rowCount ?? rows.length} 行结果</span>
      </div>

      {/* 执行消息提示（如有） */}
      {state.result?.message && (
        <p className="execution-note">{state.result.message}</p>
      )}

      {/* 自动生成的洞察图表区域 */}
      {chartSpecs.length > 0 && (
        <div className="preview-chart-grid">
          {chartSpecs.map((spec) => (
            <InsightCard
              key={`${previewKey}-${spec.metricKey}`}
              id={`${previewKey}-${spec.metricKey}`}
              type="chart"
              chartType="bar"
              title={spec.title}
              data={spec.data}
              config={{ xAxis: spec.dimensionKey, yAxis: spec.metricKey }}
              compact
              isCertified={state.result?.audit?.isCertified}
            />
          ))}
        </div>
      )}

      {/* 原始结果数据表格 */}
      {rows.length > 0 ? (
        <DataTable rows={rows} rowCount={state.result?.rowCount} onAction={onAction} />
      ) : (
        <div className="empty-result">查询成功，但没有返回数据。</div>
      )}

      <style jsx>{`
        .preview-execution {
          border-radius: 14px;
          border: 1px solid var(--surface-border);
          background: #FFFFFF;
        }
        .execution-ready {
          display: flex;
          flex-direction: column;
          gap: 14px;
          padding: 16px;
        }
        .execution-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .execution-title {
          display: flex;
          align-items: center;
          gap: 8px;
          color: var(--success);
          font-size: 13px;
          font-weight: 800;
        }
        .execution-count {
          font-family: var(--font-mono);
          font-size: 10px;
          font-weight: 800;
          color: var(--text-tertiary);
          background: #F8FAFC;
          border: 1px solid #E2E8F0;
          border-radius: 999px;
          padding: 4px 10px;
          white-space: nowrap;
        }
        .execution-note,
        .empty-result {
          margin: 0;
          font-size: 13px;
          color: var(--text-secondary);
        }
        .preview-chart-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
          gap: 12px;
        }
        @media (max-width: 640px) {
          .preview-chart-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
