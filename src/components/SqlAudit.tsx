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
  const planId = rawAudit.planId;
  const approvalChain = Array.isArray(rawAudit.approvalChain) ? rawAudit.approvalChain : [];
  const shortHash = (value?: string) => value ? value.slice(0, 12) : 'pending';
  
  const safeAssumptions = Array.isArray(assumptions) && assumptions.length > 0
    ? assumptions
    : (Array.isArray(rawAudit.assumptions) && rawAudit.assumptions.length > 0
      ? rawAudit.assumptions
      : (plan.assumptions || []));

  const metrics = plan.metrics || plan.lineage?.metrics || [];
  const dimensions = plan.dimensions || plan.lineage?.dimensions || [];
  const analysis = rawAudit.analysis || plan.analysis;
  const analysisEvents = Array.isArray(analysis?.events) ? analysis.events : [];
  const formatAuditValue = (value: any): string => {
    if (value === undefined || value === null || value === '') return '未指定';
    if (typeof value !== 'object') return String(value);
    return Object.entries(value)
      .filter(([, entryValue]) => entryValue !== undefined)
      .map(([key, entryValue]) => `${key}: ${String(entryValue)}`)
      .join(' / ');
  };

  const hasData = !!(sql || explanation || safeAssumptions.length > 0 || analysis);
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
              <span className="protocol-label">{analysis ? 'ANALYSIS_TEMPLATE_AUDIT' : isCertified ? 'CERTIFIED_AUDIT_PROTOCOL' : 'EXPLORATORY_SQL_AUDIT'}</span>
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

              {analysis && (
                <div className="analysis-template-panel">
                  <div className="analysis-template-header">
                    <Settings2 size={14} />
                    <span>{String(analysis.template).toUpperCase()} TEMPLATE</span>
                  </div>
                  <div className="analysis-meta-grid">
                    <div>
                      <span className="analysis-meta-label">实体口径</span>
                      <strong>{analysis.entity?.label || analysis.entity?.id}</strong>
                      <small>{analysis.entity?.column}</small>
                    </div>
                    <div>
                      <span className="analysis-meta-label">时间窗口</span>
                      <strong>{formatAuditValue(analysis.timeWindow)}</strong>
                    </div>
                    <div>
                      <span className="analysis-meta-label">模板参数</span>
                      <strong>{formatAuditValue(analysis.parameters)}</strong>
                    </div>
                  </div>
                  {analysisEvents.length > 0 && (
                    <div className="analysis-event-list">
                      {analysisEvents.map((event: any) => (
                        <div key={event.id} className="analysis-event-chip">
                          <span>{event.name}</span>
                          <small>{event.actorColumn} / {event.timestampColumn}</small>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              
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

              {approvalChain.length > 0 && (
                <div className="approval-chain-panel">
                  <div className="approval-chain-header">
                    <ShieldCheck size={14} />
                    <span>PREVIEW → CONFIRM → EXECUTE</span>
                  </div>
                  <div className="approval-meta-row">
                    {planId && <span className="approval-chip">PLAN {planId}</span>}
                    <span className="approval-chip">PREVIEW SQL {shortHash(rawAudit.preview?.sqlHash)}</span>
                    {rawAudit.executed?.sqlHash && (
                      <span className="approval-chip">EXEC SQL {shortHash(rawAudit.executed.sqlHash)}</span>
                    )}
                  </div>
                  <div className="approval-steps">
                    {approvalChain.map((event: any, idx: number) => (
                      <div key={`${event.stage}-${idx}`} className={`approval-step ${event.stage}`}>
                        <span className="step-dot" />
                        <span className="step-label">{event.stage}</span>
                        {(event.sqlHash || event.planHash) && (
                          <span className="step-hash">{shortHash(event.sqlHash || event.planHash)}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="audit-grid">
              {analysis && (
                <div className="audit-section full-width analysis-summary">
                  <div className="section-header">
                    <div className="icon-box assets">
                      <Settings2 size={14} />
                    </div>
                    <div className="label-group">
                      <span className="section-label">分析模板审计</span>
                      <span className="section-sub">ANALYSIS_TEMPLATE_LINEAGE</span>
                    </div>
                  </div>
                  <div className="section-content">
                    <div className="analysis-template-panel compact">
                      <div className="analysis-meta-grid">
                        <div>
                          <span className="analysis-meta-label">模板</span>
                          <strong>{String(analysis.template)}</strong>
                        </div>
                        <div>
                          <span className="analysis-meta-label">实体口径</span>
                          <strong>{analysis.entity?.label || analysis.entity?.id}</strong>
                          <small>{analysis.entity?.column}</small>
                        </div>
                        <div>
                          <span className="analysis-meta-label">时间窗口</span>
                          <strong>{formatAuditValue(analysis.timeWindow)}</strong>
                        </div>
                        <div>
                          <span className="analysis-meta-label">参数</span>
                          <strong>{formatAuditValue(analysis.parameters)}</strong>
                        </div>
                      </div>
                      <div className="analysis-event-list">
                        {analysisEvents.map((event: any) => (
                          <div key={event.id} className="analysis-event-chip">
                            <span>{event.name}</span>
                            <small>{event.actorColumn} / {event.timestampColumn}</small>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {approvalChain.length > 0 && (
                <div className="audit-section full-width">
                  <div className="section-header">
                    <div className="icon-box assets">
                      <ShieldCheck size={14} />
                    </div>
                    <div className="label-group">
                      <span className="section-label">确认执行链路</span>
                      <span className="section-sub">PREVIEW_CONFIRM_EXECUTE</span>
                    </div>
                  </div>
                  <div className="section-content">
                    <div className="approval-meta-row">
                      {planId && <span className="approval-chip">PLAN {planId}</span>}
                      <span className="approval-chip">PREVIEW SQL {shortHash(rawAudit.preview?.sqlHash)}</span>
                      {rawAudit.executed?.sqlHash && (
                        <span className="approval-chip">EXEC SQL {shortHash(rawAudit.executed.sqlHash)}</span>
                      )}
                    </div>
                  </div>
                </div>
              )}
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
        
        .trigger-right { display: flex; align-items: center; gap: 14px; }
        
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

        .analysis-template-panel {
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding: 14px;
          border: 1px solid #DBEAFE;
          border-radius: 10px;
          background: #EFF6FF;
        }
        .analysis-template-panel.compact {
          background: #F8FAFC;
          border-color: #E2E8F0;
        }
        .analysis-template-header {
          display: flex;
          align-items: center;
          gap: 8px;
          font-family: var(--font-mono);
          font-size: 10px;
          font-weight: 800;
          color: #1D4ED8;
        }
        .analysis-meta-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 10px;
        }
        .analysis-meta-grid div {
          display: flex;
          flex-direction: column;
          gap: 3px;
          min-width: 0;
        }
        .analysis-meta-label {
          font-size: 9px;
          font-weight: 800;
          color: #64748B;
          text-transform: uppercase;
        }
        .analysis-meta-grid strong {
          font-size: 12px;
          color: #0F172A;
          overflow-wrap: anywhere;
        }
        .analysis-meta-grid small {
          font-family: var(--font-mono);
          font-size: 9px;
          color: #64748B;
          overflow-wrap: anywhere;
        }
        .analysis-event-list {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .analysis-event-chip {
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 130px;
          max-width: 100%;
          padding: 8px 10px;
          border-radius: 8px;
          background: #FFFFFF;
          border: 1px solid #BFDBFE;
        }
        .analysis-event-chip span {
          font-size: 11px;
          font-weight: 800;
          color: #1E40AF;
        }
        .analysis-event-chip small {
          font-family: var(--font-mono);
          font-size: 9px;
          color: #64748B;
          overflow-wrap: anywhere;
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

        .approval-chain-panel {
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding: 14px;
          border: 1px solid #A7F3D0;
          border-radius: 12px;
          background: #ECFDF5;
        }
        .approval-chain-header {
          display: flex;
          align-items: center;
          gap: 8px;
          font-family: var(--font-mono);
          font-size: 10px;
          font-weight: 800;
          color: #047857;
        }
        .approval-meta-row {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .approval-chip {
          padding: 4px 8px;
          border-radius: 6px;
          background: #FFFFFF;
          border: 1px solid #D1FAE5;
          font-family: var(--font-mono);
          font-size: 9px;
          font-weight: 800;
          color: #065F46;
        }
        .approval-steps {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
          gap: 8px;
        }
        .approval-step {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
          padding: 8px;
          border-radius: 8px;
          background: rgba(255,255,255,0.75);
          border: 1px solid rgba(16, 185, 129, 0.16);
        }
        .step-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #10B981;
          flex-shrink: 0;
        }
        .approval-step.reject .step-dot,
        .approval-step.cancel .step-dot {
          background: #F59E0B;
        }
        .step-label {
          font-size: 11px;
          font-weight: 800;
          color: #065F46;
          text-transform: uppercase;
        }
        .step-hash {
          margin-left: auto;
          font-family: var(--font-mono);
          font-size: 9px;
          font-weight: 700;
          color: #047857;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .copy-mini { color: var(--text-tertiary); padding: 6px; border-radius: 6px; }
        .copy-mini:hover { color: var(--accent-primary); background: rgba(99, 102, 241, 0.05); }

        .expand-hint { display: flex; align-items: center; gap: 6px; color: var(--text-tertiary); }
        .hint-text { font-size: 10px; font-weight: 700; text-transform: uppercase; }
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
          .audit-grid { grid-template-columns: 1fr; }
          .audit-section.full-width { grid-column: span 1; }
        }
      `}</style>
    </div>
  );
}
