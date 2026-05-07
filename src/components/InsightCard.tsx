'use client';

import React from 'react';
import { Pin, X, TrendingUp, TrendingDown, ShieldCheck, Info, Download, Layers, Code, Zap, BarChart2, AreaChart as AreaIcon } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github.css';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  BarChart,
  Bar,
  Cell,
} from 'recharts';

interface InsightCardProps {
  id: string;
  type: 'kpi' | 'chart' | 'table' | 'anomaly';
  title: string;
  description?: string;
  value?: string | number;
  trend?: { value: string; isUp: boolean };
  data?: any[];
  chartType?: 'area' | 'bar';
  isAnomaly?: boolean;
  compact?: boolean; 
  isCertified?: boolean; 
  audit?: {
    sql: string;
    explanation: string;
    isCertified?: boolean;
    certification?: {
      isCertified?: boolean;
      certificationLevel?: string;
    };
    plan?: any;
  };
}

export default function InsightCard({
  id,
  type,
  title,
  description,
  value,
  trend,
  data = [],
  chartType = 'area',
  isAnomaly,
  compact = false,
  isCertified = false,
  audit,
}: InsightCardProps) {
  const [isMounted, setIsMounted] = React.useState(false);
  const [showAudit, setShowAudit] = React.useState(false);
  const [isPinned, setIsPinned] = React.useState(false);
  const chartHeight = compact ? 120 : 200;

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) return <div style={{ height: 240 }} className="card-skeleton" />;

  const effectiveIsCertified = isCertified ||
    audit?.isCertified === true ||
    audit?.certification?.isCertified === true ||
    audit?.certification?.certificationLevel === 'certified_plan' ||
    audit?.plan?.certificationLevel === 'certified_plan' || 
    audit?.plan?.certificationLevel === 'certified';

  // 改进的数据 Key 识别逻辑
  const detectKeys = () => {
    if (data.length === 0) return { xKey: 'name', yKey: 'value' };
    const keys = Object.keys(data[0]);
    const xKey = keys.find(k => ['name', 'date', 'category', 'label', 'segment', 'username'].includes(k.toLowerCase())) || keys[0];
    const yKey = keys.find(k => k !== xKey && !k.includes('growth') && typeof data[0][k] === 'number') 
                || keys.find(k => k !== xKey && !k.includes('growth')) 
                || 'value';
    return { xKey, yKey };
  };

  const { xKey, yKey } = detectKeys();
  const growthKey = data.length > 0 ? Object.keys(data[0]).find(k => k.includes('growth')) : null;

  return (
    <div className={`insight-card ${type} ${compact ? 'compact' : ''} ${isAnomaly ? 'anomaly' : ''} animate-slide-up`}>
      <div className="card-header">
        <div className="header-main">
          <div className="title-group">
            <div className="title-icon">
              {type === 'chart' && (chartType === 'area' ? <AreaIcon size={14} /> : <BarChart2 size={14} />)}
              {type === 'kpi' && <TrendingUp size={14} />}
            </div>
            <h3>{title}</h3>
            {effectiveIsCertified && (
              <div className="certified-badge-pill" onClick={() => setShowAudit(true)}>
                <ShieldCheck size={10} />
                <span>语义认证</span>
              </div>
            )}
          </div>
          {description && <p className="description">{description}</p>}
        </div>
        <div className="header-actions">
          {audit && (
            <button className="audit-trigger-btn" onClick={() => setShowAudit(true)}>
              审计
            </button>
          )}
          <div className={`pin-action ${isPinned ? 'active' : ''}`} onClick={() => setIsPinned(!isPinned)}>
            <Pin size={14} />
          </div>
        </div>
      </div>

      <div className="card-content">
        {type === 'kpi' && (
          <div className="kpi-hero">
            <div className="kpi-value-main">{value}</div>
            {trend && (
              <div className={`kpi-trend-tag ${trend.isUp ? 'up' : 'down'}`}>
                {trend.isUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                <span>{trend.value}</span>
              </div>
            )}
          </div>
        )}

        {type === 'chart' && (
          <div className="chart-wrapper" style={{ height: chartHeight }}>
            <ResponsiveContainer width="100%" height="100%">
              {chartType === 'area' ? (
                <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id={`grad-${id}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="rgba(0,0,0,0.03)" />
                  <XAxis
                    dataKey={xKey}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: 'var(--text-tertiary)', fontWeight: 500 }}
                    dy={10}
                  />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} />
                  <RechartsTooltip
                    content={({ active, payload }) => {
                      const point = payload?.[0];
                      if (active && point?.payload && point.value != null) {
                        return (
                          <div className="custom-tooltip">
                            <p className="label">{`${point.payload[xKey]}`}</p>
                            <p className="value">{`${point.value.toLocaleString()}`}</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey={yKey}
                    stroke="var(--accent-primary)"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill={`url(#grad-${id})`}
                    animationDuration={1500}
                  />
                </AreaChart>
              ) : (
                <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }} barSize={32}>
                  <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="rgba(0,0,0,0.03)" />
                  <XAxis
                    dataKey={xKey}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: 'var(--text-tertiary)', fontWeight: 500 }}
                    dy={10}
                  />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} />
                  <RechartsTooltip
                    cursor={{ fill: 'rgba(99, 102, 241, 0.04)' }}
                    content={({ active, payload }) => {
                      const point = payload?.[0];
                      if (active && point?.payload && point.value != null) {
                        return (
                          <div className="custom-tooltip">
                            <p className="label">{`${point.payload[xKey]}`}</p>
                            <p className="value">{`${point.value.toLocaleString()}`}</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey={yKey} radius={[6, 6, 0, 0]} animationDuration={1200}>
                    {data.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={index === data.length - 1 ? 'var(--accent-primary)' : 'rgba(99, 102, 241, 0.4)'} 
                      />
                    ))}
                  </Bar>
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        )}

        {type === 'table' && (
          <div className="data-table-minimal">
            {data.slice(0, compact ? 3 : 5).map((row, i) => (
              <div key={i} className="table-row">
                <div className="row-info">
                  <span className="name">{row[xKey]}</span>
                  {growthKey && row[growthKey] !== undefined && (
                    <span className={`growth ${row[growthKey] > 0 ? 'up' : 'down'}`}>
                      {row[growthKey] > 0 ? '↑' : '↓'} {(Math.abs(row[growthKey]) * 100).toFixed(1)}%
                    </span>
                  )}
                </div>
                <div className="row-value-group">
                  <span className="val">{row[yKey]?.toLocaleString()}</span>
                  <div className="progress-bg">
                    <div className="progress-fill" style={{ width: `${Math.min(100, (Number(row[yKey]) / (Math.max(...data.map(d => d[yKey])) || 1)) * 100)}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Audit Cockpit Overlay */}
      {showAudit && audit && (
        <div className={`audit-overlay-dimmed ${effectiveIsCertified ? 'is-certified' : ''}`} onClick={() => setShowAudit(false)}>
          <div className="audit-cockpit-panel animate-scale-up" onClick={e => e.stopPropagation()}>
            <div className="panel-header">
              <div className="header-identity">
                <div className={`protocol-icon ${effectiveIsCertified ? 'certified' : 'raw'}`}>
                  {effectiveIsCertified ? <ShieldCheck size={14} /> : <Info size={14} />}
                </div>
                <div className="identity-text">
                  <h4>{effectiveIsCertified ? '语义认证审计' : '探索性逻辑审计'}</h4>
                  <span className="id-sub">{effectiveIsCertified ? 'V1.2 / 已认证计划' : '逻辑链路追踪'}</span>
                </div>
              </div>
              <button className="panel-close" onClick={() => setShowAudit(false)}><X size={16} /></button>
            </div>
            
            <div className="panel-body">
              <div className="cockpit-grid">
                {/* 只有认证审计才显示语义血缘 */}
                {effectiveIsCertified && (
                  <div className="grid-card full">
                    <div className="card-label">
                      <Layers size={12} />
                      <span>语义资产血缘 (SEMANTIC_LINEAGE)</span>
                    </div>
                    <div className="lineage-content">
                      <div className="lineage-item">
                        <span className="type">核心指标</span>
                        <div className="badges">
                          {(audit.plan?.metrics || audit.plan?.lineage?.metrics || ['未明确']).map((m: any, i: number) => (
                            <span key={i} className="pill metric">{typeof m === 'string' ? m : (m.id || m.name)}</span>
                          ))}
                        </div>
                      </div>
                      <div className="lineage-item">
                        <span className="type">分析维度</span>
                        <div className="badges">
                          {(audit.plan?.dimensions || audit.plan?.lineage?.dimensions || ['全局聚合']).map((d: any, i: number) => (
                            <span key={i} className="pill dimension">{typeof d === 'string' ? d : (d.id || d.name)}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 逻辑说明 */}
                <div className="grid-card">
                  <div className="card-label">
                    <Info size={12} />
                    <span>业务逻辑解析 (LOGIC_DECODING)</span>
                  </div>
                  <p className="logic-text">{audit.explanation}</p>
                </div>

                {/* 核心假设 */}
                <div className="grid-card">
                  <div className="card-label">
                    <Zap size={12} />
                    <span>前置业务假设 (ASSUMPTIONS)</span>
                  </div>
                  <div className="assumption-list">
                    {audit.plan?.assumptions && audit.plan.assumptions.length > 0 ? (
                      audit.plan.assumptions.map((a: string, i: number) => (
                        <div key={i} className="item">
                          <span className="dot" />
                          <span>{a}</span>
                        </div>
                      ))
                    ) : (
                      <p className="empty-msg">遵循标准业务口径，无特殊假设。</p>
                    )}
                  </div>
                </div>

                {/* SQL 执行层 */}
                <div className="grid-card full code-card">
                  <div className="card-label-row">
                    <div className="card-label">
                      <Code size={12} />
                      <span>底层执行脚本 (SQL_SOURCE)</span>
                    </div>
                    <button className="copy-code-btn" onClick={() => navigator.clipboard.writeText(audit.sql)}>
                      复制
                    </button>
                  </div>
                  <div className="code-render">
                    <ReactMarkdown rehypePlugins={[rehypeHighlight]}>
                      {`\`\`\`sql\n${audit.sql}\n\`\`\``}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .insight-card {
          background: #FFFFFF;
          border: 1px solid #E2E8F0;
          border-radius: 16px;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 20px;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
          position: relative;
        }
        .insight-card:hover {
          border-color: var(--accent-primary);
          box-shadow: 0 12px 24px -12px rgba(99, 102, 241, 0.12);
        }

        .card-header { display: flex; justify-content: space-between; align-items: flex-start; }
        .title-group { display: flex; align-items: center; gap: 10px; }
        .title-icon { 
          width: 24px; height: 24px; border-radius: 6px; 
          background: rgba(99, 102, 241, 0.04); color: var(--accent-primary);
          display: flex; align-items: center; justify-content: center;
        }
        h3 { font-size: 14px; font-weight: 700; color: #1E293B; margin: 0; }
        
        .certified-badge-pill {
          display: flex; align-items: center; gap: 4px; padding: 2px 8px;
          background: linear-gradient(135deg, #6366F1, #8B5CF6);
          border-radius: 99px; color: #FFF; font-size: 9px; font-weight: 700;
          cursor: pointer;
        }

        .description { font-size: 12px; color: #64748B; margin: 4px 0 0 0; line-height: 1.5; }
        .header-actions { display: flex; align-items: center; gap: 8px; }
        
        .audit-trigger-btn {
          font-size: 11px; font-weight: 600; color: #475569;
          border: 1px solid #E2E8F0; padding: 4px 10px; border-radius: 8px;
          background: #FFF; cursor: pointer; transition: all 0.2s;
        }
        .audit-trigger-btn:hover { 
          border-color: var(--accent-primary); 
          color: var(--accent-primary);
          background: rgba(99, 102, 241, 0.02);
        }

        .pin-action {
          width: 28px; height: 28px; border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
          color: #CBD5E1; cursor: pointer; transition: all 0.2s;
          border: 1px solid transparent;
        }
        .pin-action:hover {
          color: var(--accent-primary);
          background: rgba(99, 102, 241, 0.04);
          border-color: rgba(99, 102, 241, 0.1);
        }
        .pin-action.active {
          color: var(--accent-primary);
          background: rgba(99, 102, 241, 0.08);
          transform: rotate(45deg);
        }

        .kpi-hero { padding: 8px 0; }
        .kpi-value-main { font-size: 32px; font-weight: 800; color: #0F172A; letter-spacing: -0.02em; }
        .kpi-trend-tag { 
          display: inline-flex; align-items: center; gap: 4px; margin-top: 8px;
          font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 20px;
        }
        .kpi-trend-tag.up { background: #ECFDF5; color: #059669; }
        .kpi-trend-tag.down { background: #FEF2F2; color: #DC2626; }

        .custom-tooltip {
          background: rgba(15, 23, 42, 0.9); backdrop-filter: blur(8px);
          padding: 10px 14px; border-radius: 10px;
          box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); border: 1px solid rgba(255,255,255,0.1);
        }
        .custom-tooltip .label { color: #94A3B8; font-size: 10px; margin: 0; font-weight: 600; text-transform: uppercase; }
        .custom-tooltip .value { color: #FFF; font-size: 16px; margin: 4px 0 0 0; font-weight: 800; }

        .data-table-minimal { display: flex; flex-direction: column; gap: 12px; }
        .table-row { display: flex; flex-direction: column; gap: 6px; }
        .row-info { display: flex; justify-content: space-between; align-items: center; }
        .row-info .name { font-size: 13px; font-weight: 600; color: #475569; }
        .row-info .growth { font-size: 11px; font-weight: 700; }
        .row-info .growth.up { color: #10B981; }
        .row-info .growth.down { color: #EF4444; }
        
        .row-value-group { display: flex; align-items: center; gap: 12px; }
        .row-value-group .val { font-size: 14px; font-weight: 700; color: #1E293B; min-width: 60px; text-align: right; }
        .progress-bg { flex: 1; height: 6px; background: #F1F5F9; border-radius: 3px; overflow: hidden; }
        .progress-fill { height: 100%; background: linear-gradient(to right, #6366F1, #8B5CF6); border-radius: 3px; }

        /* Audit Overlay */
        .audit-overlay-dimmed {
          position: absolute; inset: 0; z-index: 100;
          background: rgba(255, 255, 255, 0.4); backdrop-filter: blur(6px);
          display: flex; align-items: center; justify-content: center; padding: 12px;
          cursor: pointer;
        }
        .audit-cockpit-panel {
          width: 100%; height: 100%; background: #FFF; border-radius: 12px;
          border: 1px solid #E2E8F0; display: flex; flex-direction: column;
          box-shadow: 0 30px 60px -12px rgba(99, 102, 241, 0.15); overflow: hidden;
          cursor: default;
        }
        .panel-header {
          padding: 10px 16px; border-bottom: 1px solid #F1F5F9; background: #FFF;
          display: flex; justify-content: space-between; align-items: center;
        }
        .header-identity { display: flex; align-items: center; gap: 10px; }
        .protocol-icon {
          width: 24px; height: 24px; border-radius: 6px;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .protocol-icon.certified { background: #6366F1; color: #FFF; box-shadow: 0 2px 8px rgba(99, 102, 241, 0.2); }
        .protocol-icon.raw { background: #F1F5F9; color: #64748B; }
        
        .identity-text { display: flex; flex-direction: column; gap: 0; }
        .identity-text h4 { font-size: 13px; font-weight: 800; color: #1E293B; margin: 0; line-height: 1.2; }
        .id-sub { font-family: var(--font-mono); font-size: 8px; color: #94A3B8; font-weight: 700; letter-spacing: 0.05em; line-height: 1.2; }
        .panel-close { color: #94A3B8; cursor: pointer; background: none; border: none; padding: 4px; border-radius: 6px; display: flex; align-items: center; }
        .panel-close:hover { background: #F1F5F9; color: #475569; }
        
        .panel-body { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px; }
        .cockpit-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .grid-card { 
          background: #F8FAFC; border: 1px solid #F1F5F9; border-radius: 10px; padding: 12px;
          display: flex; flex-direction: column; gap: 8px;
        }
        .grid-card.full { grid-column: span 2; }
        
        .card-label { 
          display: flex; align-items: center; gap: 6px; 
          font-size: 10px; font-weight: 700; color: #94A3B8;
          font-family: var(--font-mono); letter-spacing: 0.02em;
        }
        .card-label span { opacity: 0.8; }
        
        .lineage-content { display: flex; flex-direction: column; gap: 8px; }
        .lineage-item { display: flex; align-items: center; gap: 12px; }
        .lineage-item .type { font-size: 10px; font-weight: 800; color: #64748B; width: 60px; text-transform: uppercase; }
        .badges { display: flex; flex-wrap: wrap; gap: 4px; }
        .pill { padding: 1px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
        .pill.metric { background: #EEF2FF; color: #4F46E5; border: 1px solid rgba(99, 102, 241, 0.08); }
        .pill.dimension { background: #F5F3FF; color: #7C3AED; border: 1px solid rgba(139, 92, 246, 0.08); }
        
        .logic-text { font-size: 13px; color: #334155; line-height: 1.5; margin: 0; }
        .assumption-list { display: flex; flex-direction: column; gap: 6px; }
        .item { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #475569; }
        .dot { width: 3px; height: 3px; border-radius: 50%; background: #6366F1; opacity: 0.6; flex-shrink: 0; }
        
        .empty-msg { font-size: 13px; color: #334155; line-height: 1.5; margin: 0; }
        
        .card-label-row { display: flex; justify-content: space-between; align-items: center; }
        .copy-code-btn { 
          font-size: 9px; font-weight: 800; color: #6366F1; background: #FFF; 
          border: 1px solid #E0E7FF; padding: 2px 8px; border-radius: 4px; 
          cursor: pointer; transition: all 0.2s;
        }
        .copy-code-btn:hover { background: #F5F7FF; border-color: #6366F1; }

        .code-render :global(pre) { 
          margin: 0 !important; padding: 8px !important; background: #FFF !important; 
          border: 1px solid #E2E8F0 !important; border-radius: 6px !important;
          font-size: 11px !important; white-space: pre-wrap !important;
          line-height: 1.4 !important;
        }

        @keyframes slide-up { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes scale-up { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
      `}</style>
    </div>
  );
}
