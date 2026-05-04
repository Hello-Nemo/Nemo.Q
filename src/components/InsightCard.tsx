'use client';

import React from 'react';
import { Pin, Maximize2, X, TrendingUp, TrendingDown, AlertCircle, ShieldCheck, Info } from 'lucide-react';
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
  Legend,
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
  isCertified?: boolean; // 是否为认证语义查询
  audit?: {
    sql: string;
    explanation: string;
    plan?: any;
  };
}

export default function InsightCard({
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
  const chartHeight = compact ? 120 : 180;

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  // 自动检测数据结构
  const hasComparison = data.length > 0 && Object.keys(data[0]).some(k => k.endsWith('_prev'));
  
  // 提取动态数据键
  const mainMetricKey = data.length > 0 ? Object.keys(data[0]).find(k => !k.endsWith('_prev') && !k.endsWith('_growth') && k !== 'name' && k !== 'id') || 'value' : 'value';
  const prevMetricKey = `${mainMetricKey}_prev`;
  const growthKey = `${mainMetricKey}_growth`;

  // 计算自动趋势 (如果 prop 未提供)
  const autoTrend = React.useMemo(() => {
    if (trend) return trend;
    if (!hasComparison || data.length === 0) return null;
    const lastPoint = data[data.length - 1];
    const growth = lastPoint[growthKey];
    if (growth === undefined) return null;
    
    return {
      value: `${(growth * 100).toFixed(1)}%`,
      isUp: growth > 0
    };
  }, [trend, hasComparison, data, growthKey]);

  return (
    <div className={`insight-card soft-surface ${isAnomaly ? 'anomaly' : ''} ${compact ? 'compact' : ''} ${isCertified ? 'certified' : ''}`}>
      {/* Header */}
      <div className="card-header">
        <div className="header-meta">
          <div className="title-row">
            <h3 className="card-title">{title}</h3>
            {isCertified && (
              <div className="certified-badge" title="语义认证查询">
                <ShieldCheck size={12} />
                <span>已认证</span>
              </div>
            )}
          </div>
          {description && <p className="card-desc">{description}</p>}
        </div>
        <div className="card-actions">
          <button className="icon-btn" onClick={() => setShowAudit(!showAudit)} title="查看逻辑详情">
            <Info size={14} />
          </button>
          <button className="icon-btn" title="固定至画布"><Pin size={14} /></button>
          {!compact && <button className="icon-btn" title="全屏查看"><Maximize2 size={14} /></button>}
        </div>
      </div>

      {/* KPI Display */}
      {type === 'kpi' && (
        <div className="kpi-display">
          <div className="kpi-main">
            <span className="kpi-value">{value}</span>
            {autoTrend && (
              <div className={`kpi-trend ${autoTrend.isUp ? 'up' : 'down'}`}>
                {autoTrend.isUp ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                <span>{autoTrend.value}</span>
              </div>
            )}
          </div>
          {data && data.length > 0 && isMounted && (
            <div className="mini-spark">
              <ResponsiveContainer width="100%" height={40}>
                <AreaChart data={data}>
                  <Area
                    type="monotone"
                    dataKey={mainMetricKey}
                    stroke={autoTrend?.isUp ? '#10b981' : '#ef4444'}
                    fill={autoTrend?.isUp ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)'}
                    strokeWidth={2}
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Main Charts */}
      {type === 'chart' && (
        <div className="chart-container" style={{ height: chartHeight }}>
          {isMounted ? (
            <ResponsiveContainer width="100%" height="100%">
              {chartType === 'bar' ? (
                <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }} />
                  <RechartsTooltip
                    cursor={{ fill: 'rgba(0,0,0,0.02)' }}
                    contentStyle={{ 
                      background: 'rgba(255,255,255,0.9)', 
                      backdropFilter: 'blur(10px)',
                      border: 'none', 
                      borderRadius: '16px', 
                      boxShadow: 'var(--shadow-soft)' 
                    }}
                  />
                  {hasComparison && <Legend verticalAlign="top" align="right" iconType="circle" height={30} wrapperStyle={{ fontSize: '11px' }} />}
                  
                  <Bar name="本期" dataKey={mainMetricKey} radius={[6, 6, 0, 0]} barSize={hasComparison ? 12 : 24} fill="var(--accent-primary)" />
                  {hasComparison && (
                    <Bar name="上期" dataKey={prevMetricKey} radius={[6, 6, 0, 0]} barSize={12} fill="var(--text-quaternary)" fillOpacity={0.3} />
                  )}
                </BarChart>
              ) : (
                <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id={`mainG-${title}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }} />
                  <RechartsTooltip
                    contentStyle={{ 
                      background: 'rgba(255,255,255,0.9)', 
                      backdropFilter: 'blur(10px)',
                      border: 'none', 
                      borderRadius: '16px', 
                      boxShadow: 'var(--shadow-soft)' 
                    }}
                  />
                  {hasComparison && <Legend verticalAlign="top" align="right" iconType="plainline" height={30} wrapperStyle={{ fontSize: '11px' }} />}
                  
                  {/* 历史周期背景线 */}
                  {hasComparison && (
                    <Area 
                      name="上期"
                      type="monotone" 
                      dataKey={prevMetricKey} 
                      stroke="var(--text-quaternary)" 
                      fill="transparent"
                      strokeWidth={2} 
                      strokeDasharray="5 5"
                      dot={false}
                    />
                  )}
                  
                  {/* 当前周期主线 */}
                  <Area 
                    name="本期"
                    type="monotone" 
                    dataKey={mainMetricKey} 
                    stroke="var(--accent-primary)" 
                    fill={`url(#mainG-${title})`} 
                    strokeWidth={3} 
                    dot={{ r: 4, fill: '#FFF', stroke: 'var(--accent-primary)', strokeWidth: 2 }}
                    activeDot={{ r: 6, strokeWidth: 0 }}
                  />
                </AreaChart>
              )}
            </ResponsiveContainer>
          ) : (
            <div className="chart-skeleton" />
          )}
        </div>
      )}

      {/* Data List (Table) */}
      {type === 'table' && (
        <div className="data-list">
          {data.slice(0, compact ? 3 : 5).map((row, i) => (
            <div key={i} className="list-item">
              <div className="item-info">
                <span className="item-name">{row.name || row.id || Object.values(row)[0]}</span>
                {row[growthKey] !== undefined && (
                  <span className={`item-growth ${row[growthKey] > 0 ? 'up' : 'down'}`}>
                    {row[growthKey] > 0 ? '+' : ''}{(row[growthKey] * 100).toFixed(1)}%
                  </span>
                )}
              </div>
              <span className="item-value">{row[mainMetricKey]}</span>
              <div className="item-track">
                <div className="item-fill" style={{ width: `${Math.min(100, (Number(row[mainMetricKey]) / 1000) * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Audit Panel Overlay */}
      {showAudit && audit && (
        <div className="audit-overlay">
          <div className="audit-content soft-surface">
            <div className="audit-header">
              <ShieldCheck size={16} className="certified-icon" />
              <h4>语义查询审计</h4>
              <button className="close-btn" onClick={() => setShowAudit(false)}><X size={16} /></button>
            </div>
            <div className="audit-body">
              <div className="audit-section">
                <label>业务逻辑说明</label>
                <p>{audit.explanation}</p>
              </div>
              <div className="audit-section">
                <label>生成 SQL</label>
                <pre><code>{audit.sql}</code></pre>
              </div>
              {audit.plan && (
                <div className="audit-section">
                  <label>Query Plan (IR)</label>
                  <pre><code>{JSON.stringify(audit.plan, null, 2)}</code></pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Anomaly Style */}
      {type === 'anomaly' && (
        <div className="anomaly-box">
          <div className="anomaly-aura" />
          <div className="anomaly-content">
            <AlertCircle size={20} className="anomaly-icon" />
            <div className="anomaly-text">
              <p>{description}</p>
              <button className="action-link">查看深度解析 →</button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .insight-card {
          padding: 24px;
          transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
          border: 1px solid rgba(255,255,255,0.5);
          position: relative;
          overflow: hidden;
        }
        .insight-card:hover {
          transform: translateY(-4px) scale(1.02);
          box-shadow: var(--shadow-deep);
        }
        .insight-card.compact { padding: 16px; }
        .insight-card.certified { border-color: rgba(99, 102, 241, 0.2); }

        .card-header { display: flex; justify-content: space-between; margin-bottom: 20px; }
        .title-row { display: flex; align-items: center; gap: 8px; }
        .card-title { font-size: 15px; font-weight: 700; color: var(--text-primary); margin: 0; }
        .card-desc { font-size: 12px; color: var(--text-tertiary); margin: 4px 0 0; }
        
        .certified-badge {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 2px 6px;
          background: rgba(99, 102, 241, 0.1);
          color: var(--accent-primary);
          border-radius: 6px;
          font-size: 10px;
          font-weight: 700;
        }

        .card-actions { display: flex; gap: 8px; }
        .icon-btn { color: var(--text-tertiary); padding: 4px; transition: all 0.3s; border-radius: 8px; }
        .icon-btn:hover { color: var(--accent-primary); background: rgba(0,0,0,0.04); }

        .kpi-display { display: flex; flex-direction: column; gap: 12px; }
        .kpi-main { display: flex; align-items: baseline; gap: 12px; }
        .kpi-value { font-size: 32px; font-weight: 800; color: var(--text-primary); letter-spacing: -0.02em; }
        .kpi-trend { display: flex; align-items: center; gap: 4px; font-size: 13px; font-weight: 600; padding: 2px 8px; border-radius: 20px; }
        .kpi-trend.up { color: #10b981; background: rgba(16, 185, 129, 0.1); }
        .kpi-trend.down { color: #ef4444; background: rgba(239, 68, 68, 0.1); }

        .chart-container { width: 100%; margin-top: 10px; }
        
        .data-list { display: flex; flex-direction: column; gap: 12px; }
        .list-item { display: grid; grid-template-columns: 1fr auto; gap: 8px; position: relative; padding-bottom: 14px; }
        .item-info { display: flex; align-items: center; gap: 8px; }
        .item-name { font-size: 13px; color: var(--text-secondary); font-weight: 500; }
        .item-growth { font-size: 11px; font-weight: 700; }
        .item-growth.up { color: #10b981; }
        .item-growth.down { color: #ef4444; }
        .item-value { font-size: 13px; color: var(--text-primary); font-weight: 700; }
        .item-track { grid-column: 1 / 3; height: 6px; background: rgba(0,0,0,0.04); border-radius: 3px; overflow: hidden; }
        .item-fill { height: 100%; background: var(--accent-flow); border-radius: 3px; opacity: 0.6; }

        .audit-overlay {
          position: absolute;
          inset: 0;
          background: rgba(255,255,255,0.8);
          backdrop-filter: blur(8px);
          z-index: 10;
          display: flex;
          padding: 12px;
          animation: fadeIn 0.3s ease;
        }
        .audit-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          border: 1px solid rgba(0,0,0,0.05);
          overflow: hidden;
        }
        .audit-header {
          padding: 12px 16px;
          border-bottom: 1px solid rgba(0,0,0,0.05);
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .audit-header h4 { font-size: 13px; font-weight: 700; margin: 0; flex: 1; }
        .certified-icon { color: var(--accent-primary); }
        .close-btn { color: var(--text-tertiary); padding: 4px; }
        
        .audit-body { padding: 16px; overflow-y: auto; display: flex; flex-direction: column; gap: 16px; }
        .audit-section label { display: block; font-size: 11px; font-weight: 700; color: var(--text-tertiary); text-transform: uppercase; margin-bottom: 6px; }
        .audit-section p { font-size: 13px; color: var(--text-secondary); margin: 0; line-height: 1.5; }
        .audit-section pre { 
          background: #f8f9fa; 
          padding: 12px; 
          border-radius: 8px; 
          font-size: 11px; 
          overflow-x: auto; 
          margin: 0;
          border: 1px solid rgba(0,0,0,0.03);
        }

        .anomaly-box { position: relative; padding: 16px; border-radius: 20px; overflow: hidden; background: rgba(239, 68, 68, 0.03); }
        .anomaly-aura { position: absolute; inset: 0; background: linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, transparent 100%); }
        .anomaly-content { position: relative; display: flex; gap: 12px; }
        .anomaly-icon { color: #ef4444; flex-shrink: 0; }
        .anomaly-text p { font-size: 13px; color: var(--text-primary); margin: 0 0 8px; line-height: 1.5; }
        .action-link { font-size: 12px; font-weight: 700; color: #ef4444; border-bottom: 2px solid transparent; }
        .action-link:hover { border-bottom-color: #ef4444; }

        @keyframes fadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }

        .insight-card.anomaly { border-color: rgba(239, 68, 68, 0.2); }
      `}</style>
    </div>
  );
}
