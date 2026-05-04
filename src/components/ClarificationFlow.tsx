'use client';

import React, { useState } from 'react';
import { 
  HelpCircle, 
  ArrowRight, 
  CornerDownRight, 
  Zap, 
  SkipForward,
  MessageSquare
} from 'lucide-react';

interface ClarificationOption {
  label: string;
  value: string;
  description?: string;
}

interface ClarificationFlowProps {
  question: string;
  options: (string | ClarificationOption)[];
  context?: string;
  defaultAssumption?: string;
  onSelect: (value: string) => void;
  onSkip: () => void;
}

export default function ClarificationFlow({ 
  question, 
  options, 
  context, 
  defaultAssumption,
  onSelect, 
  onSkip 
}: ClarificationFlowProps) {
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSelect = (val: string | ClarificationOption) => {
    if (isProcessing) return;
    setIsProcessing(true);
    const result = typeof val === 'string' ? val : val.value;
    onSelect(result);
  };

  const handleSkip = () => {
    if (isProcessing) return;
    setIsProcessing(true);
    onSkip();
  };

  return (
    <div className="clarification-container animate-slide-up">
      {/* Question Section */}
      <div className="question-header">
        <div className="status-badge">
          <div className="pulse-dot" />
          <span>决策等待中 / WAITING_FOR_DECISION</span>
        </div>
        <h2 className="main-question">{question}</h2>
      </div>

      {/* Context Panel */}
      {context && (
        <div className="context-panel">
          <div className="panel-label">
            <MessageSquare size={12} />
            <span>上下文线索 / CONTEXT_CLUES</span>
          </div>
          <p className="context-desc">{context}</p>
        </div>
      )}

      {/* Options Grid */}
      <div className="decisions-grid">
        {options && options.length > 0 ? (
          options.map((opt, idx) => {
            const label = typeof opt === 'string' ? opt : opt.label;
            const desc = typeof opt === 'string' ? null : opt.description;
            
            return (
              <button
                key={idx}
                className="decision-card"
                disabled={isProcessing}
                onClick={() => handleSelect(opt)}
                style={{ animationDelay: `${idx * 0.1}s` }}
              >
                <div className="card-content">
                  <span className="card-index">0{idx + 1}</span>
                  <div className="text-stack">
                    <span className="card-text">{label}</span>
                    {desc && <span className="card-desc">{desc}</span>}
                  </div>
                </div>
                <div className="card-action">
                  <ArrowRight size={14} />
                </div>
                <div className="hover-glow" />
              </button>
            );
          })
        ) : (
          <div className="no-options-fallback">
            <CornerDownRight size={16} />
            <span>AI 未提供预设选项，请直接在下方输入框说明您的定义</span>
          </div>
        )}
      </div>

      {/* Recommendation Engine / Default Path */}
      <div className="recommendation-zone">
        <div className="rec-header">
          <Zap size={14} className="spark-icon" />
          <span>AI 推荐决策路径 / RECO_ENGINE</span>
        </div>
        
        <div className="rec-content">
          <div className="assumption-block">
            <div className="assumption-meta">遵循默认业务假设：</div>
            <div className="assumption-text">{defaultAssumption && defaultAssumption !== '无' ? defaultAssumption : '按标准分析逻辑继续执行'}</div>
          </div>
          
          <button 
            className={`action-skip-btn ${isProcessing ? 'loading' : ''}`}
            onClick={handleSkip}
            disabled={isProcessing}
          >
            <div className="btn-inner">
              <span>{isProcessing ? '处理中...' : '跳过确认并直接执行'}</span>
              <SkipForward size={14} />
            </div>
          </button>
        </div>
      </div>

      <style jsx>{`
        .clarification-container {
          background: rgba(255, 255, 255, 0.9);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(99, 102, 241, 0.1);
          border-radius: 24px;
          padding: 32px;
          display: flex;
          flex-direction: column;
          gap: 28px;
          box-shadow: 
            0 20px 50px -12px rgba(99, 102, 241, 0.12),
            0 0 1px 1px rgba(99, 102, 241, 0.05);
          max-width: 800px;
          margin: 12px 0;
        }

        /* Question Header */
        .question-header { display: flex; flex-direction: column; gap: 12px; }
        .status-badge {
          display: inline-flex; align-items: center; gap: 8px;
          background: rgba(99, 102, 241, 0.05);
          padding: 4px 12px; border-radius: 99px;
          font-family: var(--font-mono); font-size: 10px; font-weight: 800; color: var(--accent-primary);
          width: fit-content;
        }
        .pulse-dot { width: 6px; height: 6px; background: var(--accent-primary); border-radius: 50%; animation: pulse-dot 2s infinite; }
        @keyframes pulse-dot { 0% { opacity: 0.4; } 50% { opacity: 1; } 100% { opacity: 0.4; } }
        .main-question { font-size: 22px; font-weight: 800; color: var(--text-primary); letter-spacing: -0.02em; line-height: 1.3; }

        /* Context Panel */
        .context-panel {
          background: #F8FAFC; padding: 16px 20px; border-radius: 12px;
          border: 1px solid #F1F5F9;
        }
        .panel-label { display: flex; align-items: center; gap: 8px; font-family: var(--font-mono); font-size: 9px; font-weight: 800; color: #94A3B8; margin-bottom: 6px; }
        .context-desc { font-size: 14px; color: #475569; line-height: 1.6; }

        /* Decisions Grid */
        .decisions-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px; }
        .decision-card {
          position: relative; padding: 20px 24px; background: #FFF;
          border: 1px solid #E2E8F0; border-radius: 16px;
          display: flex; align-items: center; justify-content: space-between;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          cursor: pointer; overflow: hidden;
          animation: slide-in 0.5s ease both;
        }
        @keyframes slide-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        
        .card-content { display: flex; align-items: flex-start; gap: 16px; position: relative; z-index: 2; }
        .card-index { font-family: var(--font-mono); font-size: 11px; font-weight: 800; color: #CBD5E1; margin-top: 3px; }
        .text-stack { display: flex; flex-direction: column; gap: 4px; text-align: left; }
        .card-text { font-size: 15px; font-weight: 700; color: #1E293B; line-height: 1.2; }
        .card-desc { font-size: 11px; font-weight: 500; color: #64748B; line-height: 1.4; opacity: 0.8; }
        .card-action { width: 28px; height: 28px; border-radius: 50%; background: #F8FAFC; display: flex; align-items: center; justify-content: center; color: #94A3B8; transition: all 0.3s; position: relative; z-index: 2; flex-shrink: 0; }
        
        .decision-card:hover { border-color: var(--accent-primary); transform: translateY(-4px); box-shadow: 0 12px 24px -8px rgba(99, 102, 241, 0.15); }
        .decision-card:hover .card-action { background: var(--accent-primary); color: #FFF; transform: rotate(-45deg); }
        .decision-card:hover .card-index { color: var(--accent-primary); opacity: 0.5; }
        
        .hover-glow { position: absolute; inset: 0; background: radial-gradient(circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(99, 102, 241, 0.03), transparent 70%); opacity: 0; transition: opacity 0.3s; }
        .decision-card:hover .hover-glow { opacity: 1; }

        /* Recommendation Zone */
        .recommendation-zone {
          padding: 24px; background: linear-gradient(135deg, #F0FDF4 0%, #F8FAFC 100%);
          border: 1px solid #DCFCE7; border-radius: 20px;
          display: flex; flex-direction: column; gap: 16px;
        }
        .rec-header { display: flex; align-items: center; gap: 8px; font-family: var(--font-mono); font-size: 10px; font-weight: 800; color: #059669; }
        .spark-icon { animation: spark 2s infinite; }
        @keyframes spark { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.6; transform: scale(1.1); } }
        
        .rec-content { display: flex; align-items: center; justify-content: space-between; gap: 32px; }
        .assumption-block { display: flex; flex-direction: column; gap: 4px; }
        .assumption-meta { font-size: 11px; font-weight: 700; color: #64748B; opacity: 0.8; }
        .assumption-text { font-size: 14px; font-weight: 700; color: #065F46; }

        .action-skip-btn {
          background: #0F172A; color: #FFF; padding: 12px 24px; border-radius: 12px;
          border: none; cursor: pointer; transition: all 0.3s; flex-shrink: 0;
        }
        .btn-inner { display: flex; align-items: center; gap: 10px; font-size: 13px; font-weight: 800; }
        .action-skip-btn:hover:not(:disabled) { background: #1E293B; transform: scale(1.02); box-shadow: 0 8px 16px -4px rgba(0,0,0,0.2); }
        .action-skip-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .action-skip-btn.loading .btn-inner { opacity: 0.7; }

        @media (max-width: 640px) {
          .rec-content { flex-direction: column; align-items: stretch; gap: 20px; }
          .action-skip-btn { width: 100%; }
        }
        .no-options-fallback {
          grid-column: 1 / -1;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 20px;
          background: rgba(99, 102, 241, 0.03);
          border: 1px dashed rgba(99, 102, 241, 0.2);
          border-radius: 16px;
          color: var(--text-secondary);
          font-size: 14px;
        }
      `}</style>
    </div>
  );
}
