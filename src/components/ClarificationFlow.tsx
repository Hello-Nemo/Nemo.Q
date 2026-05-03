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

interface ClarificationFlowProps {
  question: string;
  options: string[];
  context?: string;
  defaultAssumption?: string;
  onSelect: (option: string) => void;
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
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  return (
    <div className="flow-root animate-fade-in">
      {/* Question Header */}
      <div className="flow-header">
        <div className="header-icon">
          <HelpCircle size={18} />
        </div>
        <div className="header-text">
          <span className="protocol-tag">ACTION_REQUIRED: CLARIFICATION</span>
          <h2 className="question-title">{question}</h2>
        </div>
      </div>

      {/* Context Intelligence Card */}
      {context && (
        <div className="context-card">
          <div className="context-label">
            <MessageSquare size={12} />
            <span>对话上下文背景 (DIALOGUE_CONTEXT)</span>
          </div>
          <p className="context-text">{context}</p>
        </div>
      )}

      {/* Options Selection Grid */}
      <div className="options-grid">
        {options?.map((opt, idx) => (
          <button
            key={idx}
            className={`option-card ${hoveredIndex === idx ? 'hovered' : ''}`}
            onMouseEnter={() => setHoveredIndex(idx)}
            onMouseLeave={() => setHoveredIndex(null)}
            onClick={() => onSelect(opt)}
          >
            <div className="option-inner">
              <span className="option-text">{opt}</span>
              <ArrowRight size={14} className="arrow-icon" />
            </div>
            <div className="active-glow" />
          </button>
        ))}
      </div>

      {/* Default Path Strategy */}
      <div className="default-path">
        <div className="path-label">
          <CornerDownRight size={14} />
          <span>推荐执行路径 (RECOMMENDED_PATH)</span>
        </div>
        <div className="path-action">
          <div className="assumption-box">
            <Zap size={14} className="zap-icon" />
            <div className="assumption-content">
              <span className="label">默认假设 (DEFAULT_ASSUMPTION)</span>
              <p className="val">{defaultAssumption || '按常规逻辑继续执行'}</p>
            </div>
          </div>
          <button onClick={onSkip} className="skip-btn">
            <span>跳过并采用默认路径</span>
            <SkipForward size={14} />
          </button>
        </div>
      </div>

      <style jsx>{`
        .flow-root {
          background: #FFFFFF;
          border: 1px solid var(--surface-border-strong);
          border-radius: var(--radius-lg);
          padding: 32px;
          display: flex;
          flex-direction: column;
          gap: 24px;
          box-shadow: var(--card-shadow);
          max-width: 800px;
        }

        .flow-header { display: flex; gap: 20px; align-items: flex-start; }
        .header-icon {
          width: 44px;
          height: 44px;
          background: #F0FDF4;
          border: 1px solid #DCFCE7;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--novapulse);
          flex-shrink: 0;
          box-shadow: 0 4px 12px rgba(16, 185, 129, 0.1);
        }
        .header-text { flex: 1; }
        .protocol-tag { font-family: var(--font-mono); font-size: 10px; font-weight: 800; color: var(--text-tertiary); letter-spacing: 0.1em; }
        .question-title { font-size: 18px; font-weight: 800; color: var(--text-primary); margin-top: 4px; line-height: 1.4; }

        .context-card {
          padding: 16px 20px;
          background: #F8FAFC;
          border-left: 3px solid var(--surface-border-strong);
          border-radius: 4px 12px 12px 4px;
        }
        .context-label { display: flex; align-items: center; gap: 8px; font-family: var(--font-mono); font-size: 9px; font-weight: 800; color: var(--text-tertiary); letter-spacing: 0.05em; margin-bottom: 8px; }
        .context-text { font-size: 13px; font-weight: 500; color: var(--text-secondary); line-height: 1.6; }

        .options-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .option-card {
          position: relative;
          padding: 20px;
          background: #FFFFFF;
          border: 1px solid var(--surface-border-strong);
          border-radius: 12px;
          text-align: left;
          overflow: hidden;
          transition: all 0.3s var(--spring);
        }
        .option-inner { display: flex; align-items: center; justify-content: space-between; position: relative; z-index: 2; }
        .option-text { font-size: 14px; font-weight: 700; color: var(--text-primary); }
        .arrow-icon { color: var(--text-tertiary); transition: all 0.3s var(--spring); }
        
        .option-card:hover { border-color: var(--novapulse); transform: translateY(-2px); box-shadow: 0 8px 24px rgba(16, 185, 129, 0.08); }
        .option-card:hover .arrow-icon { color: var(--novapulse); transform: translateX(4px); }
        .active-glow { position: absolute; inset: 0; background: linear-gradient(135deg, rgba(16, 185, 129, 0.05) 0%, transparent 100%); opacity: 0; transition: opacity 0.3s; }
        .option-card:hover .active-glow { opacity: 1; }

        .default-path {
          margin-top: 8px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          padding-top: 24px;
          border-top: 1px solid var(--surface-border);
        }
        .path-label { display: flex; align-items: center; gap: 8px; font-family: var(--font-mono); font-size: 10px; font-weight: 800; color: var(--text-tertiary); letter-spacing: 0.1em; }
        .path-action { display: flex; align-items: center; justify-content: space-between; gap: 20px; }
        
        .assumption-box { 
          flex: 1; display: flex; align-items: center; gap: 14px; padding: 12px 16px; 
          background: #F0FDF4; border: 1px solid #DCFCE7; border-radius: 8px; 
        }
        .zap-icon { color: var(--novapulse); }
        .assumption-content { display: flex; flex-direction: column; gap: 2px; }
        .assumption-content .label { font-family: var(--font-mono); font-size: 9px; font-weight: 800; color: var(--text-tertiary); letter-spacing: 0.05em; }
        .assumption-content .val { font-size: 13px; font-weight: 700; color: var(--text-secondary); }

        .skip-btn {
          display: flex; align-items: center; gap: 8px; padding: 12px 20px; 
          background: var(--text-primary); color: #FFFFFF; border-radius: 8px; 
          font-size: 13px; font-weight: 800; transition: all 0.2s;
        }
        .skip-btn:hover { background: #1E293B; transform: translateX(2px); }
      `}</style>
    </div>
  );
}
