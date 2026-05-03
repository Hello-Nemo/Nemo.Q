'use client';

import React from 'react';
import { Pin, Maximize2, X, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';
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
}

export default function InsightCard({
  type,
  title,
  description,
  value,
  trend,
  data,
  chartType = 'area',
  isAnomaly,
  compact = false,
}: InsightCardProps) {
  const [isMounted, setIsMounted] = React.useState(false);
  const chartHeight = compact ? 120 : 180;

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  return (
    <div className={`insight-card soft-surface ${isAnomaly ? 'anomaly' : ''} ${compact ? 'compact' : ''}`}>
      {/* Header */}
      <div className="card-header">
        <div className="header-meta">
          <h3 className="card-title">{title}</h3>
          {description && <p className="card-desc">{description}</p>}
        </div>
        <div className="card-actions">
          <button className="icon-btn" title="Pin"><Pin size={14} /></button>
          {!compact && <button className="icon-btn" title="Expand"><Maximize2 size={14} /></button>}
        </div>
      </div>

      {/* KPI Display */}
      {type === 'kpi' && (
        <div className="kpi-display">
          <div className="kpi-main">
            <span className="kpi-value">{value}</span>
            {trend && (
              <div className={`kpi-trend ${trend.isUp ? 'up' : 'down'}`}>
                {trend.isUp ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                <span>{trend.value}</span>
              </div>
            )}
          </div>
          {data && data.length > 0 && isMounted && (
            <div className="mini-spark">
              <ResponsiveContainer width="100%" height={40}>
                <AreaChart data={data}>
                  <defs>
                    <linearGradient id="sparkGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={trend?.isUp ? '#10b981' : '#ef4444'} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={trend?.isUp ? '#10b981' : '#ef4444'} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke={trend?.isUp ? '#10b981' : '#ef4444'}
                    fill="url(#sparkGradient)"
                    strokeWidth={2}
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
                <BarChart data={data || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
                  <Bar dataKey="value" radius={[10, 10, 10, 10]} barSize={24}>
                    {(data || []).map((_, index) => (
                      <Cell key={`c-${index}`} fill={index % 2 === 0 ? 'var(--accent-primary)' : 'var(--accent-secondary)'} fillOpacity={0.8} />
                    ))}
                  </Bar>
                </BarChart>
              ) : (
                <AreaChart data={data || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
                  <Area 
                    type="monotone" 
                    dataKey="value" 
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
          {(data || []).slice(0, compact ? 3 : 5).map((row, i) => (
            <div key={i} className="list-item">
              <span className="item-name">{row.name}</span>
              <span className="item-value">{row.value}</span>
              <div className="item-track">
                <div className="item-fill" style={{ width: `${Math.min(100, (Number(row.value) / 1000) * 100)}%` }} />
              </div>
            </div>
          ))}
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
        }
        .insight-card:hover {
          transform: translateY(-4px) scale(1.02);
          box-shadow: var(--shadow-deep);
        }
        .insight-card.compact { padding: 16px; }

        .card-header { display: flex; justify-content: space-between; margin-bottom: 20px; }
        .card-title { font-size: 15px; font-weight: 700; color: var(--text-primary); margin: 0; }
        .card-desc { font-size: 12px; color: var(--text-tertiary); margin: 4px 0 0; }
        
        .card-actions { display: flex; gap: 8px; }
        .icon-btn { color: var(--text-tertiary); padding: 4px; transition: color 0.3s; }
        .icon-btn:hover { color: var(--accent-primary); }

        .kpi-display { display: flex; flex-direction: column; gap: 12px; }
        .kpi-main { display: flex; align-items: baseline; gap: 12px; }
        .kpi-value { font-size: 32px; font-weight: 800; color: var(--text-primary); letter-spacing: -0.02em; }
        .kpi-trend { display: flex; align-items: center; gap: 4px; font-size: 13px; font-weight: 600; padding: 2px 8px; border-radius: 20px; }
        .kpi-trend.up { color: #10b981; background: rgba(16, 185, 129, 0.1); }
        .kpi-trend.down { color: #ef4444; background: rgba(239, 68, 68, 0.1); }

        .chart-container { width: 100%; margin-top: 10px; }
        
        .data-list { display: flex; flex-direction: column; gap: 12px; }
        .list-item { display: grid; grid-template-columns: 1fr auto; gap: 8px; position: relative; padding-bottom: 14px; }
        .item-name { font-size: 13px; color: var(--text-secondary); font-weight: 500; }
        .item-value { font-size: 13px; color: var(--text-primary); font-weight: 700; }
        .item-track { grid-column: 1 / 3; height: 6px; background: rgba(0,0,0,0.04); border-radius: 3px; overflow: hidden; }
        .item-fill { height: 100%; background: var(--accent-flow); border-radius: 3px; opacity: 0.6; }

        .anomaly-box { position: relative; padding: 16px; border-radius: 20px; overflow: hidden; background: rgba(239, 68, 68, 0.03); }
        .anomaly-aura { position: absolute; inset: 0; background: linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, transparent 100%); }
        .anomaly-content { position: relative; display: flex; gap: 12px; }
        .anomaly-icon { color: #ef4444; flex-shrink: 0; }
        .anomaly-text p { font-size: 13px; color: var(--text-primary); margin: 0 0 8px; line-height: 1.5; }
        .action-link { font-size: 12px; font-weight: 700; color: #ef4444; border-bottom: 2px solid transparent; }
        .action-link:hover { border-bottom-color: #ef4444; }

        .insight-card.anomaly { border-color: rgba(239, 68, 68, 0.2); }
      `}</style>
    </div>
  );
}
