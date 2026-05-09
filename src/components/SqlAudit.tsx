'use client';

import React, { useState } from 'react';
import { 
  CheckCircle2, 
  Copy, 
  Check,
  Terminal, 
  Info, 
  Database,
  ArrowRight,
  ChevronDown,
  ShieldCheck,
  Zap,
  Layers,
  FileSearch,
  Code,
  Eye,
  Settings2
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github.css';
import PlanVisualizer from './PlanVisualizer';

interface SqlAuditProps {
  sql?: string;
  explanation?: string;
  assumptions?: string[];
  isStreaming?: boolean;
  debugRaw?: any;
}

export default function SqlAudit({ sql = '', explanation = '', assumptions = [], isStreaming = false, debugRaw = null }: SqlAuditProps) {
  // Extract audit data from debugRaw if available
  const rawAudit = debugRaw?.output?.audit || debugRaw?.state?.audit || {};
  const plan = rawAudit.plan || {};
  
  const safeAssumptions = Array.isArray(assumptions) 
    ? assumptions 
    : (plan.assumptions || []);

  const metrics = plan.metrics || plan.lineage?.metrics || [];
  const dimensions = plan.dimensions || plan.lineage?.dimensions || [];

  const hasData = !!(sql || explanation || safeAssumptions.length > 0);
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<'logic' | 'sql'>('logic');

  const lineage = plan.lineage || rawAudit.lineage;

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

  const isCertified = !!(rawAudit.isCertified || plan.certificationLevel === 'certified_plan');

  return (
    <div className={`audit-wrapper ${isOpen ? 'is-open' : 'is-collapsed'} ${!hasData ? 'is-empty' : ''} ${isCertified ? 'certified' : ''}`}>
      <div className="audit-trigger" onClick={() => setIsOpen(!isOpen)}>
        <div className="trigger-left">
          <div className="status-indicator">
            <div className={`pulse-dot ${hasData ? 'active' : ''}`} />
            <div className="protocol-badge">
              {isCertified ? <ShieldCheck size={10} /> : <FileSearch size={10} />}
              <span className="protocol-label">{isCertified ? 'CERTIFIED_AUDIT_PROTOCOL' : 'EXPLORATORY_SQL_AUDIT'}</span>
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
          {isOpen && lineage && (
            <div className="view-toggle" onClick={(e) => e.stopPropagation()}>
              <button 
                className={`toggle-btn ${viewMode === 'logic' ? 'active' : ''}`}
                onClick={() => setViewMode('logic')}
              >
                <Eye size={12} />
                <span>逻辑视图</span>
              </button>
              <button 
                className={`toggle-btn ${viewMode === 'sql' ? 'active' : ''}`}
                onClick={() => setViewMode('sql')}
              >
                <Code size={12} />
                <span>SQL 视图</span>
              </button>
            </div>
          )}
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
            <span className="hint-text">{isOpen ? '收起审计' : '查看详情'}</span>
            <ChevronDown size={14} className={`arrow ${isOpen ? 'up' : ''}`} />
          </div>
        </div>
      </div>

      {isOpen && (
        <div className="audit-content animate-slide-down">
          {viewMode === 'logic' && lineage ? (
            <div className="logic-view-container">
              <PlanVisualizer lineage={lineage} explanation={explanation} />
              
              <div className="logic-metadata">
                <div className="metadata-item">
                  <span className="meta-label">核心假设</span>
                  <div className="meta-content">
                    {safeAssumptions.length > 0 ? (
                      <ul className="mini-assumption-list">
                        {safeAssumptions.map((item: string, idx: number) => (
                          <li key={idx}>{item}</li>
                        ))}
                      </ul>
                    ) : (
                      <span className="empty-meta">遵循标准口径</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="audit-grid">
              {/* 语义资产区块 (Metrics & Dimensions) */}
              { (metrics.length > 0 || dimensions.length > 0) && (
              <div className="audit-section full-width semantic-summary">
                <div className="section-header">
                  <div className="icon-box assets">
                    <Layers size={14} />
                  </div>
                  <div className="label-group">
                    <span className="section-label">语义资产映射</span>
                    <span className="section-sub">SEMANTIC_ASSETS_LINEAGE</span>
                  </div>
                </div>
                <div className="section-content">
                  <div className="assets-display">
                    <div className="asset-type">
                      <span className="type-tag">指标</span>
                      <div className="tag-list">
                        {metrics.length > 0 ? metrics.map((m: any, i: number) => (
                          <span key={i} className="tag metric-tag">{typeof m === 'string' ? m : (m.id || m.name)}</span>
                        )) : <span className="tag empty">无明确指标</span>}
                      </div>
                    </div>
                    <div className="asset-type">
                      <span className="type-tag">维度</span>
                      <div className="tag-list">
                        {dimensions.length > 0 ? dimensions.map((d: any, i: number) => (
                          <span key={i} className="tag dimension-tag">{typeof d === 'string' ? d : (d.id || d.name)}</span>
                        )) : <span className="tag empty">全局聚合</span>}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              )}

              {/* 业务逻辑区块 */}
              <div className="audit-section">
                <div className="section-header">
                  <div className="icon-box info">
                    <Info size={14} />
                  </div>
                  <div className="label-group">
                    <span className="section-label">业务逻辑解析</span>
                    <span className="section-sub">LOGIC_DECODING</span>
                  </div>
                </div>
                <div className="section-content">
                  <p className="narrative-text">
                    {explanation || '等待系统挂载审计证据...'}
                  </p>
                </div>
              </div>

              {/* 业务假设区块 */}
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
                      {safeAssumptions.map((item: string, idx: number) => (
                        <li key={idx} className="assumption-item">
                          <ArrowRight size={12} className="bullet" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="empty-assumptions">
                      <p>遵循标准业务口径，无特殊假设。</p>
                    </div>
                  )}
                </div>
              </div>

              {/* SQL 区块 */}
              <div className="audit-section full-width">
                <div className="section-header">
                  <div className="icon-box code">
                    <Code size={14} />
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
                        <span>DB_SOURCE / AUTO_GENERATED</span>
                      </div>
                      <button 
                        className={`sql-copy-btn ${copied ? 'copied' : ''}`}
                        onClick={handleCopy}
                      >
                        {copied ? <Check size={12} /> : <Copy size={12} />}
                        <span>{copied ? '已复制' : '复制'}</span>
                      </button>
                    </div>
                    <div className="sql-render-area">
                      <ReactMarkdown rehypePlugins={[rehypeHighlight]}>
                        {`\`\`\`sql\n${sql?.trim() || '-- 脚本生成中...'}\n\`\`\``}
                      </ReactMarkdown>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
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
          margin: 12px 0;
        }
        .audit-wrapper.certified {
          border-left: 3px solid var(--accent-primary);
          background: linear-gradient(to right, rgba(99, 102, 241, 0.02), transparent);
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
          gap: 12px;
          cursor: pointer; 
          user-select: none;
        }
        
        .trigger-left { display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0; }
        
        .status-indicator { display: flex; align-items: center; gap: 10px; }
        .pulse-dot { 
          width: 6px; height: 6px; 
          background: var(--text-tertiary); 
          border-radius: 50%; 
        }
        .pulse-dot.active { 
          background: var(--novapulse); 
          box-shadow: 0 0 8px var(--novapulse);
          animation: orb-pulse 2s infinite;
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
          font-size: 8px; 
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
        
        .trigger-right { display: flex; align-items: center; gap: 12px; flex-shrink: 0; }
        
        .view-toggle {
          display: flex;
          background: rgba(0, 0, 0, 0.03);
          padding: 2px;
          border-radius: 8px;
          border: 1px solid var(--surface-border);
        }
        .toggle-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border-radius: 6px;
          font-size: 10px;
          font-weight: 700;
          color: var(--text-tertiary);
          transition: all 0.2s;
          white-space: nowrap;
          min-width: 76px;
          justify-content: center;
        }
        .toggle-btn.active {
          background: #FFFFFF;
          color: var(--accent-primary);
          box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }
        .toggle-btn:not(.active):hover {
          color: var(--text-secondary);
          background: rgba(0,0,0,0.02);
        }

        .logic-view-container {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        
        .logic-metadata {
          padding-top: 16px;
          border-top: 1px dashed var(--surface-border);
        }
        .metadata-item {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .meta-label {
          font-size: 10px;
          font-weight: 800;
          color: var(--text-tertiary);
          text-transform: uppercase;
        }
        .mini-assumption-list {
          list-style: none;
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .mini-assumption-list li {
          font-size: 11px;
          padding: 3px 10px;
          background: rgba(0,0,0,0.02);
          border: 1px solid var(--surface-border);
          border-radius: 6px;
          color: var(--text-secondary);
        }
        .empty-meta { font-size: 12px; color: var(--text-tertiary); font-style: italic; }

        .copy-mini { color: var(--text-tertiary); padding: 6px; border-radius: 6px; }
        .copy-mini:hover { color: var(--accent-primary); background: rgba(99, 102, 241, 0.05); }

        .expand-hint { display: flex; align-items: center; gap: 6px; color: var(--text-tertiary); }
        .hint-text { font-size: 10px; font-weight: 700; white-space: nowrap; }
        .arrow { transition: transform 0.4s var(--spring); }
        .arrow.up { transform: rotate(180deg); }

        .audit-content { 
          border-top: 1px solid var(--surface-border); 
          padding: 24px; 
        }
        
        .audit-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
        }
        
        .audit-section { display: flex; flex-direction: column; gap: 12px; }
        .audit-section.full-width { grid-column: span 2; }
        
        .section-header { display: flex; align-items: center; gap: 12px; }
        .icon-box { 
          width: 24px; height: 24px; border-radius: 6px; 
          display: flex; align-items: center; justify-content: center; 
          background: transparent;
        }
        .icon-box.info { color: var(--accent-primary); }
        .icon-box.warning { color: var(--warning); }
        .icon-box.code { color: #64748B; }
        .icon-box.assets { color: #8B5CF6; }
        
        .label-group { display: flex; flex-direction: column; }
        .section-label { font-size: 13px; font-weight: 700; color: var(--text-primary); line-height: 1.2; }
        .section-sub { font-family: var(--font-mono); font-size: 8px; font-weight: 800; color: var(--text-tertiary); letter-spacing: 0.08em; margin-top: 1px; }
        
        .section-content { padding-left: 36px; }
        .narrative-text { font-size: 14px; color: var(--text-secondary); line-height: 1.6; }

        .assets-display {
          display: flex;
          flex-direction: column;
          gap: 12px;
          background: #F8FAFC;
          padding: 12px;
          border-radius: 8px;
          border: 1px solid #F1F5F9;
        }
        .asset-type { display: flex; align-items: center; gap: 12px; }
        .type-tag { font-size: 10px; font-weight: 800; color: var(--text-tertiary); width: 40px; text-transform: uppercase; }
        .tag-list { display: flex; flex-wrap: wrap; gap: 6px; }
        .tag { 
          padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700;
          background: #FFFFFF; border: 1px solid #E2E8F0; color: #475569;
        }
        .tag.metric-tag { color: var(--accent-primary); border-color: rgba(99, 102, 241, 0.2); }
        .tag.dimension-tag { color: #8B5CF6; border-color: rgba(139, 92, 246, 0.2); }
        .tag.empty { font-style: italic; opacity: 0.5; font-weight: 400; border-style: dashed; }
        
        .assumption-list { list-style: none; display: flex; flex-direction: column; gap: 8px; }
        .assumption-item { display: flex; align-items: flex-start; gap: 10px; font-size: 13px; color: var(--text-secondary); }
        .bullet { color: var(--accent-primary); margin-top: 3px; opacity: 0.5; }

        .sql-box-wrapper { 
          background: #F8FAFC; border-radius: 12px; overflow: hidden; border: 1px solid #E2E8F0;
        }
        .sql-header {
          padding: 8px 16px; background: #F1F5F9; border-bottom: 1px solid #E2E8F0;
          display: flex; align-items: center; justify-content: space-between;
          color: #64748B; font-family: var(--font-mono); font-size: 9px; font-weight: 700;
        }
        .sql-copy-btn {
          display: flex; align-items: center; gap: 6px; padding: 4px 10px;
          border-radius: 6px; border: 1px solid #E2E8F0; background: #FFFFFF;
          color: #64748B; cursor: pointer; transition: all 0.2s; font-size: 10px; font-weight: 700;
        }
        .sql-copy-btn.copied { color: #10b981; border-color: #10b981; background: rgba(16, 185, 129, 0.05); }
        
        .sql-render-area :global(pre) {
          margin: 0 !important; padding: 16px !important; background: transparent !important;
          white-space: pre-wrap !important; word-break: break-all !important;
          font-family: 'JetBrains Mono', monospace !important; font-size: 13px !important;
        }
        .sql-render-area :global(code) { color: #334155 !important; }

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
          .audit-trigger {
            align-items: flex-start;
            flex-direction: column;
          }
          .trigger-right {
            width: 100%;
            flex-wrap: wrap;
            justify-content: flex-end;
          }
          .audit-grid { grid-template-columns: 1fr; }
          .audit-section.full-width { grid-column: span 1; }
        }
      `}</style>
    </div>
  );
}
