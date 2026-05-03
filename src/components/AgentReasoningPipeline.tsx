'use client';

import React, { useState } from 'react';
import { 
  CheckCircle2, 
  Circle, 
  Loader2, 
  ChevronRight,
  Zap,
  Activity,
  ChevronDown
} from 'lucide-react';

export interface Step {
  id: string;
  label: string;
  status: 'pending' | 'loading' | 'completed' | 'error';
}

interface PipelineProps {
  steps: Step[];
}

export const getDefaultSteps = (): Step[] => [
  { id: '1', label: '加载语义层 (SEMANTIC_LAYER)', status: 'completed' },
  { id: '2', label: '构建 SQL (SQL_SYNTHESIS)', status: 'completed' },
  { id: '3', label: '执行查询 (QUERY_EXECUTION)', status: 'loading' },
  { id: '4', label: '结果可视化 (VISUALIZATION)', status: 'pending' },
];

export default function AgentReasoningPipeline({ steps }: PipelineProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const currentStep = steps.find(s => s.status === 'loading') || steps.find(s => s.status === 'pending') || steps[steps.length - 1];
  const progressPercent = (steps.filter(s => s.status === 'completed').length / steps.length) * 100;

  return (
    <div className={`pipeline-root ${isExpanded ? 'expanded' : 'compact'}`}>
      {/* Compact Status Header */}
      <div className="pipeline-header" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="header-left">
          <div className="activity-icon">
            <Activity size={14} className={currentStep.status === 'loading' ? 'pulse' : ''} />
          </div>
          <div className="current-info">
            <span className="step-count">STEP {steps.indexOf(currentStep) + 1}/{steps.length}</span>
            <span className="step-label">{currentStep.label}</span>
          </div>
        </div>
        
        <div className="header-right">
          <div className="progress-mini">
            <div className="progress-bar" style={{ width: `${progressPercent}%` }} />
          </div>
          <ChevronDown size={14} className={`arrow ${isExpanded ? 'up' : ''}`} />
        </div>
      </div>

      {/* Expanded Detailed Steps */}
      {isExpanded && (
        <div className="steps-detail animate-slide-down">
          {steps.map((step, idx) => (
            <div key={step.id} className={`step-row ${step.status}`}>
              <div className="step-icon">
                {step.status === 'completed' && <CheckCircle2 size={14} className="icon-success" />}
                {step.status === 'loading' && <Loader2 size={14} className="icon-loading spin" />}
                {step.status === 'pending' && <Circle size={14} className="icon-pending" />}
                {step.status === 'error' && <Zap size={14} className="icon-error" />}
              </div>
              <span className="step-text">{step.label}</span>
              {idx < steps.length - 1 && <div className="step-connector" />}
            </div>
          ))}
        </div>
      )}

      <style jsx>{`
        .pipeline-root {
          background: #FFFFFF;
          border: 1px solid var(--surface-border-strong);
          border-radius: var(--radius-md);
          overflow: hidden;
          transition: all 0.3s var(--easing-standard);
        }
        .pipeline-header {
          padding: 10px 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          cursor: pointer;
          background: var(--surface-opaque);
        }

        .header-left { display: flex; align-items: center; gap: 12px; }
        .activity-icon {
          width: 24px;
          height: 24px;
          background: #FFFFFF;
          border: 1px solid var(--surface-border-strong);
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--novapulse);
        }
        .activity-icon.pulse { animation: icon-pulse 2s infinite; }
        @keyframes icon-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }

        .current-info { display: flex; align-items: center; gap: 10px; }
        .step-count { font-family: var(--font-mono); font-size: 9px; font-weight: 800; color: var(--text-tertiary); letter-spacing: 0.05em; }
        .step-label { font-size: 11px; font-weight: 700; color: var(--text-secondary); }

        .header-right { display: flex; align-items: center; gap: 16px; }
        .progress-mini { width: 60px; height: 3px; background: #F1F5F9; border-radius: 1px; overflow: hidden; }
        .progress-bar { height: 100%; background: var(--novapulse); transition: width 0.4s var(--easing-standard); }
        .arrow { color: var(--text-tertiary); transition: transform 0.3s var(--spring); }
        .arrow.up { transform: rotate(180deg); }

        .steps-detail {
          padding: 16px 20px 20px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          border-top: 1px solid var(--surface-border);
        }

        .step-row { display: flex; align-items: center; gap: 12px; position: relative; }
        .step-icon { z-index: 2; display: flex; align-items: center; justify-content: center; width: 14px; }
        .icon-success { color: var(--novapulse); }
        .icon-loading { color: var(--info); }
        .icon-pending { color: var(--text-quaternary); }
        .icon-error { color: var(--critical); }
        
        .step-text { font-size: 12px; font-weight: 600; color: var(--text-secondary); }
        .step-row.completed .step-text { color: var(--text-primary); }
        .step-row.loading .step-text { color: var(--info); }

        .step-connector {
          position: absolute;
          left: 6px;
          top: 18px;
          width: 1px;
          height: 12px;
          background: var(--surface-border);
        }

        .spin { animation: spin 2s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

        @keyframes slide-down {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-slide-down { animation: slide-down 0.3s var(--easing-standard) forwards; }
      `}</style>
    </div>
  );
}
