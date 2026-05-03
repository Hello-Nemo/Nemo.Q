'use client';

import React, { useState } from 'react';
import { Bell, AlertCircle, AlertTriangle, X, ArrowRight } from 'lucide-react';

interface Anomaly {
  id: number;
  severity: 'critical' | 'warning';
  text: string;
}

interface AlertBadgeProps {
  collapsed: boolean;
}

// Static mock anomalies — in production these would come from props/context
const ANOMALIES: Anomaly[] = [
  { id: 1, severity: 'critical', text: '库存低于阈值: iPhone 15 Pro (剩余 3 件)' },
  { id: 2, severity: 'warning', text: '客单价较上周下降 15%' },
];

export default function AlertBadge({ collapsed }: AlertBadgeProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [dismissed, setDismissed] = useState<number[]>([]);

  const active = ANOMALIES.filter(a => !dismissed.includes(a.id));
  const criticalCount = active.filter(a => a.severity === 'critical').length;

  const dismiss = (id: number) => setDismissed(prev => [...prev, id]);
  const dismissAll = () => setDismissed(ANOMALIES.map(a => a.id));

  if (active.length === 0) return null;

  return (
    <div className="alert-root">
      {/* Floating panel */}
      {isOpen && (
        <>
          <div className="backdrop" onClick={() => setIsOpen(false)} />
          <div className={`alert-panel ${collapsed ? 'panel-right' : 'panel-up'}`}>
            <div className="ap-header">
              <div className="ap-title-wrap">
                <span className="ap-title">系统异常发现</span>
                <span className="ap-badge">{active.length} 条待处理</span>
              </div>
              <button className="ap-dismiss-all" onClick={dismissAll}>忽略全部</button>
            </div>
            <div className="ap-body">
              {active.map(a => (
                <div key={a.id} className="ap-row soft-surface-hover">
                  <div className={`ap-orb ${a.severity}`} />
                  <div className="ap-content">
                    <p className="ap-text">{a.text}</p>
                    <div className="ap-footer">
                      <button className="ap-action-btn">
                        <span>查看洞察</span>
                        <ArrowRight size={10} />
                      </button>
                      <button className="ap-close-btn" onClick={() => dismiss(a.id)}>
                        <X size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Trigger */}
      <button
        className={`trigger-pill ${collapsed ? 'collapsed' : ''} ${isOpen ? 'active' : ''} soft-surface`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="icon-box">
          <Bell size={16} />
          {active.length > 0 && <div className={`status-glow ${criticalCount > 0 ? 'critical' : 'warning'}`} />}
        </div>
        {!collapsed && (
          <div className="label-box">
            <span className="trigger-label">异常告警</span>
            <span className="trigger-count">{active.length}</span>
          </div>
        )}
      </button>

      <style jsx>{`
        .alert-root { position: relative; }

        .backdrop { position: fixed; inset: 0; z-index: 49; }
        .alert-panel {
          position: absolute;
          z-index: 100;
          width: 320px;
          background: rgba(255, 255, 255, 0.85);
          backdrop-filter: blur(24px);
          border: 1px solid rgba(255, 255, 255, 0.5);
          border-radius: 28px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.12);
          overflow: hidden;
          animation: panel-reveal 0.4s var(--spring);
        }
        .panel-up { bottom: calc(100% + 12px); left: -4px; transform-origin: bottom left; }
        .panel-right { top: -8px; left: calc(100% + 20px); transform-origin: top left; }

        @keyframes panel-reveal {
          from { opacity: 0; transform: scale(0.9) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }

        .ap-header {
          padding: 24px;
          display: flex; align-items: center; justify-content: space-between;
          border-bottom: 1px solid rgba(0,0,0,0.03);
        }
        .ap-title-wrap { display: flex; flex-direction: column; gap: 4px; }
        .ap-title { font-size: 13px; font-weight: 800; color: var(--text-primary); }
        .ap-badge { font-family: var(--font-mono); font-size: 9px; font-weight: 800; color: var(--accent-primary); opacity: 0.6; }
        .ap-dismiss-all { font-size: 11px; font-weight: 700; color: var(--text-tertiary); transition: color 0.3s; }
        .ap-dismiss-all:hover { color: var(--accent-primary); }

        .ap-body { padding: 12px; display: flex; flex-direction: column; gap: 8px; }
        .ap-row {
          padding: 16px;
          display: flex; gap: 12px;
          border-radius: 20px;
          transition: all 0.3s var(--spring);
        }
        .ap-orb {
          width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; margin-top: 5px;
        }
        .ap-orb.critical { background: #ef4444; box-shadow: 0 0 10px rgba(239, 68, 68, 0.4); }
        .ap-orb.warning { background: #f59e0b; box-shadow: 0 0 10px rgba(245, 158, 11, 0.4); }

        .ap-content { flex: 1; display: flex; flex-direction: column; gap: 12px; }
        .ap-text { font-size: 13px; font-weight: 500; color: var(--text-primary); margin: 0; line-height: 1.5; }
        .ap-footer { display: flex; align-items: center; justify-content: space-between; }
        .ap-action-btn { 
          display: flex; align-items: center; gap: 4px;
          font-size: 11px; font-weight: 700; color: var(--accent-primary);
        }
        .ap-close-btn { color: var(--text-tertiary); padding: 4px; border-radius: 50%; transition: all 0.3s; }
        .ap-close-btn:hover { background: rgba(0,0,0,0.05); color: var(--text-primary); }

        .trigger-pill {
          width: 100%;
          display: flex; align-items: center; gap: 12px;
          padding: 12px;
          border-radius: 16px;
          transition: all 0.4s var(--spring);
        }
        .trigger-pill.collapsed { justify-content: center; }
        .trigger-pill:hover { transform: translateY(-2px); box-shadow: var(--shadow-deep); border-color: var(--accent-primary); }
        .trigger-pill.active { background: white; border-color: var(--accent-primary); box-shadow: var(--shadow-deep); }

        .icon-box { position: relative; color: var(--text-tertiary); transition: color 0.3s; }
        .trigger-pill:hover .icon-box, .trigger-pill.active .icon-box { color: var(--accent-primary); }
        .status-glow {
          position: absolute; top: -2px; right: -2px;
          width: 6px; height: 6px; border-radius: 50%;
          border: 1.5px solid var(--background);
        }
        .status-glow.critical { background: #ef4444; box-shadow: 0 0 8px rgba(239, 68, 68, 0.6); }
        .status-glow.warning { background: #f59e0b; box-shadow: 0 0 8px rgba(245, 158, 11, 0.6); }

        .label-box { flex: 1; display: flex; align-items: center; justify-content: space-between; }
        .trigger-label { font-size: 13px; font-weight: 700; color: var(--text-secondary); }
        .trigger-count { 
          font-family: var(--font-mono); font-size: 10px; font-weight: 800; 
          color: var(--accent-primary); background: rgba(99, 102, 241, 0.1); 
          padding: 2px 8px; border-radius: 10px;
        }
      `}</style>
    </div>
  );
}
