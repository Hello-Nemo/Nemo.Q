'use client';

import React from 'react';
import {
  ArrowRight,
  CheckCircle2,
  CircleHelp,
  Loader2,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';
import { getCompactDecisionQuestion } from '@/lib/decision-copy';
import { getDecisionOptionKey } from '@/lib/decision-options';

type DecisionStatus = 'pending' | 'resolved' | 'executing' | 'executed' | 'error';

export type DecisionOption = {
  label: string;
  value: string;
  description?: string;
  recommended?: boolean;
  disabled?: boolean;
};

type RawDecisionOption = string | DecisionOption;

interface DecisionPromptProps {
  kind: 'clarification' | 'preview';
  question: string;
  context?: string;
  options?: RawDecisionOption[];
  status?: DecisionStatus;
  selectedAnswer?: string;
  recommendedOptionValue?: string;
  surface?: 'inline' | 'composer';
  onSelect?: (value: string) => void;
  onRequestRevision?: () => void;
  onConfirmExecute?: () => void;
}

const normalizeOption = (
  option: RawDecisionOption,
  recommendedOptionValue?: string
): DecisionOption => {
  if (typeof option === 'string') {
    return {
      label: option,
      value: option,
      recommended: option === recommendedOptionValue,
    };
  }

  return {
    ...option,
    recommended: option.recommended || option.value === recommendedOptionValue,
  };
};

const statusCopy: Record<DecisionStatus, string> = {
  pending: '我需要确认一下',
  resolved: '已确认',
  executing: '正在执行',
  executed: '已执行',
  error: '需要重新处理',
};

export default function DecisionPrompt({
  kind,
  question,
  context,
  options = [],
  status = 'pending',
  selectedAnswer,
  recommendedOptionValue,
  surface = 'inline',
  onSelect,
  onRequestRevision,
  onConfirmExecute,
}: DecisionPromptProps) {
  const normalizedOptions = options.map((option) => normalizeOption(option, recommendedOptionValue)).slice(0, 3);
  const isPending = status === 'pending';
  const isBusy = status === 'executing';
  const isFinal = status === 'resolved' || status === 'executed';
  const isComposer = surface === 'composer';
  const Icon = kind === 'preview' ? ShieldCheck : CircleHelp;
  const displayQuestion = question || (kind === 'preview' ? '这个查询计划可以执行吗？' : '请确认下一步');
  const compactQuestion = getCompactDecisionQuestion(displayQuestion);

  const handleSelect = (option: DecisionOption) => {
    if (!isPending || option.disabled) return;

    if (option.value === 'confirm_execute' && onConfirmExecute) {
      onConfirmExecute();
      return;
    }

    if (option.value === 'request_revision' && onRequestRevision) {
      onRequestRevision();
      return;
    }

    onSelect?.(option.value);
  };

  return (
    <div className={`decision-prompt ${kind} ${status} ${surface}`}>
      <div className="prompt-head">
        <span className="prompt-icon">
          {isBusy ? <Loader2 size={15} className="spin" /> : isFinal ? <CheckCircle2 size={15} /> : <Icon size={15} />}
        </span>
        <span>{isComposer && status === 'pending' ? '确认一下' : statusCopy[status]}</span>
      </div>

      <div className="prompt-body">
        <h3 title={displayQuestion}>{isComposer ? compactQuestion : displayQuestion}</h3>
        {context && !isComposer && <p className="prompt-context">{context}</p>}

        {isFinal ? (
          <div className="resolved-line">
            <CheckCircle2 size={14} />
            <span>{selectedAnswer || (status === 'executed' ? '确认并执行' : '已确认')}</span>
          </div>
        ) : isBusy ? (
          <div className="busy-line">正在处理你的选择...</div>
        ) : (
          <>
            {normalizedOptions.length > 0 ? (
              <div className="option-row">
                {normalizedOptions.map((option, index) => (
                  <button
                    key={getDecisionOptionKey(option, index)}
                    type="button"
                    className={`decision-option ${option.recommended ? 'recommended' : ''}`}
                    disabled={!isPending || option.disabled}
                    onClick={() => handleSelect(option)}
                    title={isComposer ? undefined : (option.description || option.label)}
                  >
                    <span className="option-content-wrapper">
                      <span className="option-copy">
                        <span className="option-title">
                          {option.label}
                          {option.recommended && <span className="recommended-badge">推荐</span>}
                          {isComposer && option.description && (
                            <span className="info-trigger" data-tooltip={option.description}>
                              <CircleHelp size={13} style={{ pointerEvents: 'none' }} />
                            </span>
                          )}
                        </span>
                        {!isComposer && option.description && <span className="option-desc">{option.description}</span>}
                      </span>
                    </span>
                    {option.value === 'request_revision' ? <RotateCcw size={14} /> : <ArrowRight size={14} />}
                  </button>
                ))}
              </div>
            ) : (
              <div className="free-reply-hint">可以直接在下方输入你的补充说明。</div>
            )}
          </>
        )}
      </div>

      <style jsx>{`
        .decision-prompt {
          width: 100%;
          max-width: 760px;
          border: 1px solid rgba(255, 92, 0, 0.14);
          border-left: 3px solid var(--accent-primary);
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.92);
          box-shadow: var(--shadow-soft);
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .decision-prompt.composer {
          max-width: none;
          padding: 8px 6px 16px;
          display: flex;
          flex-direction: column;
          align-items: stretch;
          gap: 12px;
          border: 0;
          border-radius: 0;
          background: transparent;
          box-shadow: none;
          backdrop-filter: none;
          -webkit-backdrop-filter: none;
          overflow: visible;
        }

        .decision-prompt.resolved,
        .decision-prompt.executed {
          border-color: rgba(16, 185, 129, 0.2);
          border-left-color: var(--success);
          background: rgba(255, 255, 255, 0.84);
        }

        .decision-prompt.executing {
          border-left-color: var(--warning);
        }

        .prompt-head {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: var(--accent-primary);
          font-size: 12px;
          font-weight: 800;
          width: fit-content;
        }

        .composer .prompt-head {
          display: none;
        }

        .resolved .prompt-head,
        .executed .prompt-head {
          color: var(--success);
        }

        .executing .prompt-head {
          color: var(--warning);
        }

        .prompt-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .prompt-body {
          display: flex;
          flex-direction: column;
          gap: 12px;
          min-width: 0;
        }

        .composer .prompt-body {
          display: flex;
          flex-direction: column;
          align-items: stretch;
          gap: 12px;
        }

        h3 {
          margin: 0;
          color: var(--text-primary);
          font-size: 17px;
          line-height: 1.45;
          letter-spacing: 0;
        }

        .composer h3 {
          font-size: 14px;
          font-weight: 800;
          line-height: 1.4;
          white-space: normal;
          color: var(--text-primary);
        }

        .prompt-context {
          margin: 0;
          color: var(--text-secondary);
          font-size: 13px;
          line-height: 1.6;
        }

        .option-row {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
          gap: 10px;
        }

        .composer .option-row {
          display: flex;
          flex-direction: column;
          align-items: stretch;
          gap: 6px;
          min-width: 0;
          max-width: none;
        }

        .decision-option {
          min-height: 56px;
          padding: 12px 14px;
          border: 1px solid #E2E8F0;
          border-radius: 8px;
          background: #FFFFFF;
          color: var(--text-primary);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          text-align: left;
          transition: transform 0.12s ease-out, border-color 0.12s ease-out, background 0.12s ease-out, box-shadow 0.12s ease-out, opacity 0.12s ease-out;
        }

        .composer .decision-option {
          min-height: 40px;
          flex: none;
          width: 100%;
          padding: 8px 12px;
          border-radius: 10px;
          gap: 8px;
          border: 1px solid rgba(15, 23, 42, 0.08);
          background: #FFFFFF !important;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
        }

        .decision-option:not(:disabled):hover {
          border-color: var(--accent-primary);
          box-shadow: 0 10px 20px -14px rgba(255, 92, 0, 0.45);
          transform: translateY(-1px);
        }

        .composer .decision-option:not(:disabled):hover {
          transform: translateY(-1px);
          border-color: var(--accent-primary);
          box-shadow: 0 8px 24px -12px rgba(255, 92, 0, 0.25);
        }

        .decision-option:disabled {
          cursor: not-allowed;
          opacity: 0.58;
          transform: none;
        }

        .decision-option.recommended {
          border-color: rgba(255, 92, 0, 0.28);
          background: rgba(255, 248, 244, 0.76);
        }

        .composer .decision-option.recommended {
          border-color: rgba(15, 23, 42, 0.08); /* 初始状态保持低调 */
          background: #FFFFFF !important;
        }

        .option-content-wrapper {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          min-width: 0;
          flex: 1;
        }

        .composer .option-content-wrapper {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
          flex: 1;
        }

        .info-trigger {
          display: inline-flex;
          align-items: center;
          color: var(--text-tertiary);
          opacity: 0.6;
          transition: all 0.12s;
          position: relative;
        }

        .info-trigger:hover {
          opacity: 1;
          color: var(--accent-primary);
        }

        /* CSS Tooltip 核心样式：改为右侧弹出 */
        .info-trigger[data-tooltip]::after {
          content: attr(data-tooltip);
          position: absolute;
          left: 140%; /* 移至右侧 */
          top: 50%;
          transform: translateY(-50%) translateX(-8px); /* 初始位置略微偏左 */
          padding: 6px 12px;
          background: #1e293b;
          color: #ffffff;
          font-size: 11px;
          font-weight: 500;
          line-height: 1.5;
          white-space: pre-wrap;
          border-radius: 6px;
          box-shadow: 4px 4px 16px rgba(0,0,0,0.2);
          opacity: 0;
          pointer-events: none;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          z-index: 1000;
          width: max-content;
          max-width: 240px;
        }

        .info-trigger[data-tooltip]:hover::after {
          opacity: 1;
          transform: translateY(-50%) translateX(0); /* 归位 */
        }

        .composer .option-content-wrapper::before {
          content: '';
          display: block;
          flex: 0 0 16px;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          border: 1.5px solid rgba(15, 23, 42, 0.2);
          transition: all 0.12s ease;
          margin-top: 1px;
        }

        .composer .decision-option:not(:disabled):hover {
          border-color: var(--accent-primary) !important;
          background: rgba(255, 92, 0, 0.02) !important;
        }

        .composer .decision-option:not(:disabled):hover .option-content-wrapper::before {
          border-color: var(--accent-primary);
          background: var(--accent-primary);
          box-shadow: inset 0 0 0 3px #FFFFFF;
        }

        /* 移除默认推荐状态下的强交互，改为静默提示 */
        .composer .decision-option.recommended .option-content-wrapper::before {
          border-color: rgba(15, 23, 42, 0.2);
          background: transparent;
          box-shadow: none;
        }

        .option-copy {
          display: flex;
          flex-direction: column;
          gap: 4px;
          min-width: 0;
        }

        .composer .option-copy {
          gap: 4px;
        }

        .option-title {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
          font-size: 14px;
          font-weight: 800;
          line-height: 1.35;
        }

        .composer .option-title {
          font-size: 13px;
          line-height: 1.4;
          white-space: normal;
        }

        .recommended-badge {
          border-radius: 999px;
          padding: 2px 7px;
          background: rgba(255, 92, 0, 0.1);
          color: var(--accent-primary);
          font-size: 11px;
          font-weight: 800;
          line-height: 1.3;
        }

        .composer .recommended-badge {
          flex: 0 0 auto;
          padding: 1px 5px 2px;
          font-size: 10px;
        }

        .option-desc,
        .free-reply-hint,
        .busy-line,
        .resolved-line {
          color: var(--text-secondary);
          font-size: 12px;
          line-height: 1.5;
        }

        .free-reply-hint {
          padding: 10px 12px;
          border-radius: 8px;
          background: rgba(15, 23, 42, 0.03);
        }

        .busy-line {
          padding: 8px 10px;
          border-radius: 8px;
          background: rgba(245, 158, 11, 0.08);
          color: var(--warning);
          font-weight: 800;
          width: fit-content;
        }

        .composer .busy-line {
          padding: 6px 9px;
          white-space: nowrap;
        }

        .resolved-line {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          width: fit-content;
          max-width: 100%;
          color: var(--success);
          font-weight: 800;
          padding: 8px 10px;
          border-radius: 8px;
          background: rgba(16, 185, 129, 0.08);
        }

        .resolved-line span {
          min-width: 0;
          overflow-wrap: anywhere;
        }

        .spin {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @keyframes composer-prompt-enter {
          from {
            opacity: 0;
            transform: translateY(2px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @media (max-width: 640px) {
          .decision-prompt {
            padding: 14px;
          }

          .option-row {
            grid-template-columns: 1fr;
          }

          .decision-prompt.composer {
            gap: 10px;
          }

          .composer .prompt-body {
            gap: 10px;
          }

          .composer h3 {
            font-size: 13px;
          }

          .composer .option-row {
            gap: 8px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .decision-prompt.composer,
          .spin {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}
