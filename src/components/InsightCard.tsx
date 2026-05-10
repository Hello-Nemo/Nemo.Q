'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  BarChart, Bar,
  LineChart, Line, 
  AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import { 
  Pin, 
  ExternalLink, 
  MoreHorizontal, 
  Download, 
  Maximize2,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle2,
  AlertCircle,
  Copy,
  ChevronRight,
  Sparkles,
  Database
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';

interface InsightCardProps {
  id: string;
  title: string;
  description?: string;
  type: 'chart' | 'kpi' | 'text' | 'table';
  chartType?: 'bar' | 'line' | 'area' | 'pie' | 'composed';
  data: any[];
  config?: any;
  explanation?: string;
  audit?: {
    sql: string;
    explanation: string;
    isCertified: boolean;
  };
  compact?: boolean;
  isCertified?: boolean;
  isPinned?: boolean;
  onPin?: () => void;
  onExplode?: () => void;
}

const COLORS = ['#FF5C00', '#0F172A', '#6366F1', '#10B981', '#F59E0B', '#64748B'];

export default function InsightCard(props: InsightCardProps) {
  const { 
    title, description, type, chartType, data, config, explanation, 
    audit, compact, isCertified, isPinned, onPin 
  } = props;

  const [isAuditOpen, setIsAuditOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'insight' | 'audit'>('insight');
  const [isMounted, setIsMounted] = useState(false);
  const [chartSize, setChartSize] = useState({ width: 0, height: 0 });
  const chartRef = useRef<HTMLDivElement>(null);
  const chartHeight = compact ? 180 : 280;
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsMounted(true);
      if (typeof window !== 'undefined') {
        setTimeout(() => window.dispatchEvent(new Event('resize')), 100);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!chartRef.current || type !== 'chart') return;

    const element = chartRef.current;
    let rafId: number | null = null;
    
    const updateSize = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        const rect = element.getBoundingClientRect();
        const width = Math.floor(rect.width);
        const height = Math.floor(rect.height);
        setChartSize(prev => (
          width > 0 &&
          height > 0 &&
          (prev.width !== width || prev.height !== height)
            ? { width, height }
            : prev
        ));
      });
    };

    updateSize();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateSize);
      return () => {
        window.removeEventListener('resize', updateSize);
        if (rafId !== null) cancelAnimationFrame(rafId);
      };
    }

    const observer = new ResizeObserver(updateSize);
    observer.observe(element);
    return () => {
      observer.disconnect();
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [type, data, chartHeight]);

  const renderKPI = () => {
    if (!data || data.length === 0) return null;
    const item = data[0];
    const value = item.value;
    const label = item.label || '关键指标';
    const trend = item.trend || 0;
    const isUp = trend >= 0;

    return (
      <div className="kpi-content">
        <div className="kpi-main">
          <span className="kpi-label">{label}</span>
          <div className="kpi-value-row">
            <h2 className="kpi-value">{typeof value === 'number' ? value.toLocaleString() : value}</h2>
            {trend !== 0 && (
              <div className={`kpi-trend-tag ${isUp ? 'up' : 'down'}`}>
                {isUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                <span>{Math.abs(trend)}%</span>
              </div>
            )}
          </div>
        </div>
        {item.subtext && <p className="kpi-subtext">{item.subtext}</p>}
      </div>
    );
  };

  const xKey = config?.xAxis || (data && data.length > 0 ? Object.keys(data[0])[0] : 'name');
  const yKey = config?.yAxis || (data && data.length > 0 ? Object.keys(data[0])[1] : 'value');

  return (
    <div className={`insight-card ${compact ? 'compact' : ''} ${isCertified ? 'certified' : ''} ${isPinned ? 'is-pinned' : ''}`}>
      <div className="card-header">
        <div className="header-info">
          <div className="title-stack">
            <span className="card-type-label">{(type || 'insight').toUpperCase()}</span>
            <h3 className="card-title">{title}</h3>
          </div>
        </div>
        <div className="header-actions">
          <button 
            className={`action-btn pin-btn ${isPinned ? 'active' : ''}`}
            onClick={onPin}
            title={isPinned ? "取消固定" : "固定至画布"}
          >
            <Pin size={16} fill={isPinned ? "currentColor" : "none"} />
          </button>
          <button className="action-btn">
            <MoreHorizontal size={16} />
          </button>
        </div>
      </div>

      <div className="card-body">
        {type === 'kpi' && renderKPI()}

        {type === 'chart' && (
          <div ref={chartRef} className="chart-wrapper" style={{ height: chartHeight, width: '100%', position: 'relative' }}>
            {isMounted && chartSize.width > 0 && chartSize.height > 0 && (
              <>
                {chartType === 'area' ? (
                  <AreaChart width={chartSize.width} height={chartSize.height} data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#FF5C00" stopOpacity={0.15}/>
                        <stop offset="95%" stopColor="#FF5C00" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                    <XAxis 
                      dataKey={xKey} 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fill: '#94A3B8' }}
                      dy={10}
                    />
                    <YAxis 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fill: '#94A3B8' }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Area 
                      type="monotone" 
                      dataKey={yKey} 
                      stroke="#FF5C00" 
                      strokeWidth={3}
                      fillOpacity={1} 
                      fill="url(#colorVal)" 
                      animationDuration={1500}
                    />
                  </AreaChart>
                ) : chartType === 'bar' ? (
                  <BarChart width={chartSize.width} height={chartSize.height} data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                    <XAxis 
                      dataKey={xKey} 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fill: '#94A3B8' }}
                      dy={10}
                    />
                    <YAxis 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fill: '#94A3B8' }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar 
                      dataKey={yKey} 
                      fill="#FF5C00" 
                      radius={[6, 6, 0, 0]} 
                      barSize={24}
                      animationDuration={1500}
                    />
                  </BarChart>
                ) : (
                  <LineChart width={chartSize.width} height={chartSize.height} data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                    <XAxis 
                      dataKey={xKey} 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fill: '#94A3B8' }}
                      dy={10}
                    />
                    <YAxis 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fill: '#94A3B8' }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Line 
                      type="monotone" 
                      dataKey={yKey} 
                      stroke="#FF5C00" 
                      strokeWidth={3} 
                      dot={{ r: 4, fill: '#FFF', stroke: '#FF5C00', strokeWidth: 2 }}
                      activeDot={{ r: 6, strokeWidth: 0 }}
                      animationDuration={1500}
                    />
                  </LineChart>
                )}
              </>
            )}
          </div>
        )}

        {(description || explanation) && (
          <div className="explanation-area">
            <p className="explanation-text">{description || explanation}</p>
          </div>
        )}

        {audit && (
          <div className="audit-footer">
            <button className="audit-toggle" onClick={() => setIsAuditOpen(!isAuditOpen)}>
              <Database size={12} />
              <span>查看 SQL 逻辑</span>
              <ChevronRight size={12} className={isAuditOpen ? 'rotate-90' : ''} />
            </button>
            
            {isAuditOpen && (
              <div className="audit-detail animate-slide-down">
                <div className="audit-code-box">
                  <div className="code-header">
                    <span>SQL_SOURCE</span>
                    <button className="copy-btn"><Copy size={12} /></button>
                  </div>
                  <div className="code-body">
                    <ReactMarkdown rehypePlugins={[rehypeHighlight]}>
                      {`\`\`\`sql\n${audit.sql}\n\`\`\``}
                    </ReactMarkdown>
                  </div>
                </div>
                <p className="audit-explanation">{audit.explanation}</p>
              </div>
            )}
          </div>
        )}
      </div>

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
          width: 100%;
          min-width: 0;
        }
        .insight-card:hover {
          border-color: var(--accent-primary);
          box-shadow: 0 12px 24px -12px rgba(99, 102, 241, 0.12);
        }

        .card-header { display: flex; justify-content: space-between; align-items: flex-start; }
        .card-type-label { font-family: var(--font-mono); font-size: 9px; font-weight: 800; color: var(--accent-primary); letter-spacing: 0.1em; margin-bottom: 4px; display: block; }
        .card-title { font-size: 15px; font-weight: 800; color: var(--text-primary); margin: 0; line-height: 1.4; }
        
        .header-actions { display: flex; gap: 8px; }
        .action-btn { width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: var(--text-tertiary); transition: all 0.2s; }
        .action-btn:hover { background: rgba(0,0,0,0.03); color: var(--text-primary); }
        .pin-btn.active { color: var(--accent-primary); background: rgba(255, 92, 0, 0.05); }

        .kpi-value-row { display: flex; align-items: baseline; gap: 12px; margin-top: 4px; }
        .kpi-value { font-size: 32px; font-weight: 900; color: var(--text-primary); margin: 0; letter-spacing: -0.02em; }
        .kpi-trend-tag { display: flex; align-items: center; gap: 4px; padding: 4px 8px; border-radius: 6px; font-size: 11px; font-weight: 800; }
        .kpi-trend-tag.up { background: #ECFDF5; color: #059669; }
        .kpi-trend-tag.down { background: #FEF2F2; color: #DC2626; }

        .chart-wrapper {
          width: 100%;
          overflow: hidden;
          position: relative;
        }

        .custom-tooltip {
          background: rgba(15, 23, 42, 0.9); backdrop-filter: blur(8px);
          padding: 10px 14px; border-radius: 10px;
          border: 1px solid rgba(255,255,255,0.1);
          box-shadow: var(--shadow-large);
        }
        .tooltip-label { font-size: 11px; font-weight: 700; color: rgba(255,255,255,0.6); margin-bottom: 4px; display: block; }
        .tooltip-value { font-family: var(--font-mono); font-size: 14px; font-weight: 800; color: #FFF; }

        .explanation-area { padding-top: 12px; border-top: 1px solid rgba(0,0,0,0.03); }
        .explanation-text { font-size: 13px; color: var(--text-secondary); line-height: 1.6; margin: 0; }

        .audit-footer { margin-top: 12px; }
        .audit-toggle { display: flex; align-items: center; gap: 8px; font-size: 11px; font-weight: 700; color: var(--text-tertiary); cursor: pointer; transition: color 0.3s; }
        .audit-toggle:hover { color: var(--accent-primary); }
        .rotate-90 { transform: rotate(90deg); }

        .audit-detail { margin-top: 16px; display: flex; flex-direction: column; gap: 12px; }
        .audit-code-box { background: #0F172A; border-radius: 12px; overflow: hidden; }
        .code-header { padding: 8px 12px; background: rgba(255,255,255,0.05); display: flex; justify-content: space-between; align-items: center; font-family: var(--font-mono); font-size: 9px; color: rgba(255,255,255,0.4); }
        .code-body { padding: 12px; font-size: 12px; }
        .audit-explanation { font-size: 12px; color: var(--text-tertiary); line-height: 1.5; margin: 0; }

        @keyframes slide-down { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-slide-down { animation: slide-down 0.3s cubic-bezier(0.16, 1, 0.3, 1) both; }
      `}</style>
    </div>
  );
}

function CustomTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    return (
      <div className="custom-tooltip">
        <span className="tooltip-label">{label}</span>
        <span className="tooltip-value">{payload[0].value.toLocaleString()}</span>
      </div>
    );
  }
  return null;
}
