'use client';

import React, { useState, useEffect } from 'react';
import { 
  Code2, 
  CheckCircle2, 
  Copy, 
  Check,
  Terminal, 
  Info, 
  Database,
  ArrowRight,
  ChevronDown,
  ShieldCheck,
  Zap
} from 'lucide-react';

interface SqlAuditProps {
  sql?: string;
  explanation?: string;
  assumptions?: string[];
  isStreaming?: boolean;
  debugRaw?: any;
}

export default function SqlAudit({ sql = '', explanation = '', assumptions = [], isStreaming = false, debugRaw = null }: SqlAuditProps) {
  // Safety check: ensure assumptions is always an array
  const safeAssumptions = Array.isArray(assumptions) 
    ? assumptions 
    : (typeof assumptions === 'string' && assumptions ? [assumptions] : []);

  const hasData = !!(sql || explanation || safeAssumptions.length > 0);
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!sql) return;
    navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const truncatedExplanation = explanation 
    ? (explanation.length > 60 ? `${explanation.slice(0, 60)}...` : explanation)
    : '';

  return (
    <div className={`audit-wrapper ${isOpen ? 'is-open' : 'is-collapsed'} ${!hasData ? 'is-empty' : ''}`}>
      <div className="audit-trigger" onClick={() => setIsOpen(!isOpen)}>
        <div className="trigger-left">
          <div className="status-indicator">
            <div className={`pulse-dot ${hasData ? 'active' : ''}`} />
            <div className="protocol-badge">
              <ShieldCheck size={10} />
              <span className="protocol-label">SQL_AUDIT_PROTOCOL</span>
            </div>
          </div>
          
          <div className="v-sep" />
          
          <div className="summary-area">
            {explanation ? (
              <p className="logic-summary animate-typewriter">
                {truncatedExplanation}
              </p>
            ) : (
              <div className="shimmer-fingerprint">
                <div className="shimmer-line" style={{ width: '140px' }} />
              </div>
            )}
          </div>
        </div>
        
        <div className="trigger-right">
          {sql && (
            <button 
              className={`copy-mini ${copied ? 'success' : ''}`} 
              onClick={handleCopy}
              title="复制 SQL"
            >
              {copied ? <CheckCircle2 size={12} /> : <Copy size={12} />}
            </button>
          )}
          <div className="expand-hint">
            <span className="hint-text">{isOpen ? '收起审计' : '查看审查'}</span>
            <ChevronDown size={14} className={`arrow ${isOpen ? 'up' : ''}`} />
          </div>
        </div>
      </div>

      {isOpen && (
        <div className="audit-content animate-slide-down">
          <div className="audit-grid">
            {/* Logic Section */}
            <div className="audit-section">
              <div className="section-header">
                <div className="icon-box info">
                  <Info size={14} />
                </div>
                <div className="label-group">
                  <span className="section-label">业务逻辑解析</span>
                  <span className="section-sub">BUSINESS_LOGIC_DECODING</span>
                </div>
              </div>
              <div className="section-content">
                <p className="narrative-text">
                  {explanation || (isStreaming ? '正在同步业务逻辑解析...' : '等待系统挂载审计证据...')}
                </p>
              </div>
            </div>

            {/* Assumptions Section */}
            <div className="audit-section">
              <div className="section-header">
                <div className="icon-box warning">
                  <Zap size={14} />
                </div>
                <div className="label-group">
                  <span className="section-label">前置业务假设</span>
                  <span className="section-sub">DOMAIN_ASSUMPTIONS</span>
                </div>
              </div>
              <div className="section-content">
                {safeAssumptions.length > 0 ? (
                  <ul className="assumption-list">
                    {safeAssumptions.map((item, idx) => (
                      <li key={idx} className="assumption-item">
                        <ArrowRight size={12} className="bullet" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="empty-assumptions">
                    <p>{isStreaming ? '正在同步业务假设...' : '遵循标准业务口径，无特殊假设。'}</p>
                  </div>
                )}
              </div>
            </div>

            {/* SQL Section */}
            <div className="audit-section full-width">
              <div className="section-header">
                <div className="icon-box code">
                  <Terminal size={14} />
                </div>
                <div className="label-group">
                  <span className="section-label">底层执行脚本</span>
                  <span className="section-sub">SQL_EXECUTION_SOURCE</span>
                </div>
              </div>
              <div className="section-content">
                <div className="sql-box-wrapper">
                  <div className="sql-header">
                    <div className="sql-info">
                      <Database size={12} />
                      <span>POSTGRES_DB_SOURCE</span>
                    </div>
                    <button 
                      className={`sql-copy-btn ${copied ? 'copied' : ''}`}
                      onClick={handleCopy}
                      title="复制 SQL 脚本"
                    >
                      {copied ? <Check size={12} /> : <Copy size={12} />}
                      <span>{copied ? '已复制' : '复制'}</span>
                    </button>
                  </div>
                  <pre className="sql-code"><code>{sql?.trim() || '-- 脚本生成中...'}</code></pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .audit-wrapper { 
          background: var(--surface-opaque); 
          border: 1px solid var(--surface-border-strong); 
          border-radius: var(--radius-md); 
          overflow: hidden; 
          transition: all 0.3s var(--easing-standard);
          width: 100%;
        }
        .audit-wrapper.is-collapsed:hover { 
          border-color: var(--accent-primary); 
          box-shadow: var(--shadow-soft);
        }

        .audit-trigger { 
          padding: 10px 16px; 
          display: flex; 
          align-items: center; 
          justify-content: space-between; 
          cursor: pointer; 
          background: rgba(99, 102, 241, 0.02);
          user-select: none;
        }
        
        .trigger-left { display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0; }
        
        .status-indicator { display: flex; align-items: center; gap: 10px; }
        .pulse-dot { 
          width: 6px; height: 6px; 
          background: var(--text-tertiary); 
          border-radius: 50%; 
          transition: all 0.5s;
        }
        .pulse-dot.active { 
          background: var(--novapulse); 
          box-shadow: 0 0 8px var(--novapulse);
          animation: orb-pulse 2s infinite;
        }
        
        .sql-header { 
          display: flex; 
          align-items: center; 
          justify-content: space-between;
          padding: 6px 12px; 
          background: var(--surface-tertiary); 
          border-bottom: 1px solid var(--surface-border);
          color: var(--text-secondary);
          font-size: 10px;
          font-family: var(--font-mono);
          letter-spacing: 0.5px;
        }
        .sql-info {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .sql-copy-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border-radius: 6px;
          border: 1px solid transparent;
          background: rgba(255, 255, 255, 0.03);
          color: var(--text-tertiary);
          cursor: pointer;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          font-size: 11px;
          font-weight: 500;
          backdrop-filter: blur(4px);
        }
        .sql-copy-btn:hover {
          background: rgba(255, 255, 255, 0.12);
          color: #ffffff;
          border-color: rgba(255, 255, 255, 0.2);
          transform: translateY(-1px) scale(1.02);
          box-shadow: 
            0 4px 12px rgba(0, 0, 0, 0.3),
            0 0 0 1px rgba(255, 255, 255, 0.08);
          text-shadow: 0 0 8px rgba(255, 255, 255, 0.2);
        }
        .sql-copy-btn:hover svg {
          transform: translateY(-0.5px);
          filter: drop-shadow(0 0 4px rgba(255, 255, 255, 0.3));
        }
        .sql-copy-btn:active {
          transform: translateY(0) scale(0.98);
          background: rgba(255, 255, 255, 0.15);
          transition: all 0.1s ease;
        }
        .sql-copy-btn.copied {
          color: #34d399;
          border-color: rgba(52, 211, 153, 0.3);
          background: rgba(52, 211, 153, 0.08);
          box-shadow: 0 0 12px rgba(52, 211, 153, 0.1);
        }
        .sql-copy-btn span {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.02em;
        }
        
        .protocol-badge {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 4px 8px;
          background: rgba(99, 102, 241, 0.05);
          border-radius: 6px;
          color: var(--accent-primary);
        }
        .protocol-label { 
          font-family: var(--font-mono); 
          font-size: 9px; 
          font-weight: 800; 
          letter-spacing: 0.05em; 
        }

        .v-sep { width: 1px; height: 14px; background: var(--surface-border-strong); }

        .summary-area { flex: 1; min-width: 0; }
        .logic-summary { 
          font-size: 12px; 
          font-weight: 600; 
          color: var(--text-secondary); 
          white-space: nowrap; 
          overflow: hidden; 
          text-overflow: ellipsis; 
        }
        .logic-summary.warning { color: var(--critical); font-weight: 700; opacity: 0.8; }
        
        .shimmer-fingerprint { height: 8px; display: flex; align-items: center; }
        .shimmer-line { height: 100%; background: var(--surface-border); border-radius: 4px; position: relative; overflow: hidden; }
        .shimmer-line::after { 
          content: ""; position: absolute; inset: 0; transform: translateX(-100%); 
          background: linear-gradient(90deg, transparent, rgba(99, 102, 241, 0.1), transparent); 
          animation: sh-flow 1.5s infinite; 
        }
        @keyframes sh-flow { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }

        .trigger-right { display: flex; align-items: center; gap: 14px; }
        .copy-mini { color: var(--text-tertiary); padding: 6px; border-radius: 6px; transition: all 0.2s; }
        .copy-mini:hover { color: var(--accent-primary); background: rgba(99, 102, 241, 0.05); }
        .copy-mini.success { color: var(--novapulse); }

        .expand-hint { display: flex; align-items: center; gap: 6px; color: var(--text-tertiary); }
        .hint-text { font-size: 11px; font-weight: 700; color: var(--text-tertiary); }
        .arrow { transition: transform 0.4s var(--spring); }
        .arrow.up { transform: rotate(180deg); }

        .audit-content { 
          border-top: 1px solid var(--surface-border); 
          padding: 24px; 
          background: var(--surface-opaque);
        }
        
        .audit-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
        }
        
        .audit-section { display: flex; flex-direction: column; gap: 12px; }
        .audit-section.full-width { grid-column: span 2; }
        
        .section-header { display: flex; align-items: center; gap: 10px; }
        .icon-box { 
          width: 28px; height: 28px; border-radius: 8px; 
          display: flex; align-items: center; justify-content: center; 
        }
        .icon-box.info { background: rgba(99, 102, 241, 0.1); color: var(--accent-primary); }
        .icon-box.warning { background: rgba(245, 158, 11, 0.1); color: var(--warning); }
        .icon-box.code { background: rgba(30, 41, 59, 0.1); color: var(--text-primary); }
        
        .label-group { display: flex; flex-direction: column; }
        .section-label { font-size: 13px; font-weight: 700; color: var(--text-primary); }
        .section-sub { font-family: var(--font-mono); font-size: 9px; font-weight: 800; color: var(--text-tertiary); letter-spacing: 0.05em; margin-top: 1px; }
        
        .section-content { 
          padding-left: 38px; 
        }
        
        .narrative-text { font-size: 14px; color: var(--text-secondary); line-height: 1.6; }
        .narrative-text.error-text { color: var(--critical); font-weight: 600; background: rgba(239, 68, 68, 0.05); padding: 12px; border-radius: 8px; border-left: 3px solid var(--critical); }
        
        .assumption-list { list-style: none; display: flex; flex-direction: column; gap: 8px; }
        .assumption-item { display: flex; align-items: flex-start; gap: 10px; font-size: 13px; color: var(--text-secondary); }
        .bullet { color: var(--novapulse); margin-top: 3px; flex-shrink: 0; }
        
        .empty-assumptions { font-size: 13px; color: var(--text-tertiary); font-style: italic; }

        .sql-box-wrapper { 
          background: #0F172A; 
          border-radius: 12px; 
          overflow: hidden;
          border: 1px solid rgba(255,255,255,0.05);
        }
        .sql-header {
          padding: 8px 16px;
          background: rgba(255,255,255,0.03);
          border-bottom: 1px solid rgba(255,255,255,0.05);
          display: flex;
          align-items: center;
          gap: 8px;
          color: rgba(255,255,255,0.4);
          font-family: var(--font-mono);
          font-size: 9px;
          font-weight: 700;
        }
        .sql-code { 
          padding: 16px; 
          margin: 0;
          overflow-x: auto;
        }
        .sql-code code { 
          font-family: var(--font-mono); 
          font-size: 12px; 
          color: #94A3B8; 
          line-height: 1.6; 
        }

        @keyframes orb-pulse { 
          0% { transform: scale(1); opacity: 0.8; } 
          50% { transform: scale(1.4); opacity: 0.4; } 
          100% { transform: scale(1); opacity: 0.8; } 
        }

        .animate-typewriter { animation: typewriter 0.5s var(--easing-standard) forwards; }
        @keyframes typewriter { from { opacity: 0; transform: translateX(-4px); } to { opacity: 1; transform: translateX(0); } }

        .animate-slide-down { animation: slide-down 0.4s var(--spring) forwards; }
        @keyframes slide-down { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }

        @media (max-width: 640px) {
          .audit-grid { grid-template-columns: 1fr; }
          .audit-section.full-width { grid-column: span 1; }
        }
      `}</style>
    </div>
  );
}
