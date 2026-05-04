'use client';

import React from 'react';
import { 
  PanelLeftClose, 
  PanelLeftOpen,
  PlusCircle, 
  Sparkles,
  Settings,
  User,
  MessageSquare,
  Trash2
} from 'lucide-react';
import { useHistory } from './HistoryContext';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { sessions, currentSessionId, selectSession, createSession, deleteSession } = useHistory();

  const getGroup = (date: number) => {
    const now = new Date();
    const d = new Date(date);
    if (d.toDateString() === now.toDateString()) return '今天';
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return '昨天';
    return '较早前';
  };

  const groupedSessions = sessions.reduce((acc, s) => {
    const group = getGroup(s.updatedAt);
    if (!acc[group]) acc[group] = [];
    acc[group].push(s);
    return acc;
  }, {} as Record<string, typeof sessions>);

  const groups = ['今天', '昨天', '较早前'];

  return (
    <div className={`sidebar-inner ${collapsed ? 'collapsed' : ''}`}>
      {/* Top Section: Brand + New Chat */}
      <div className="top-section">
        <div className="sidebar-header">
          {!collapsed && (
            <div className="brand">
              <div className="brand-aura">
                <Sparkles size={16} fill="currentColor" />
              </div>
              <div className="brand-info">
                <span className="brand-name">Lumina</span>
                <span className="brand-tag">INTELLIGENCE</span>
              </div>
            </div>
          )}
          <button onClick={onToggle} className="toggle-btn soft-surface">
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
        </div>

        <div className="action-area">
          <button 
            onClick={() => createSession()}
            className={`new-analysis-btn ${collapsed ? 'collapsed' : ''} soft-surface`}
          >
            <PlusCircle size={20} className="plus-icon" />
            {!collapsed && <span>开启新洞察</span>}
            <div className="btn-glow" />
          </button>
        </div>
      </div>

      {/* Middle Section: Search + History */}
      <div className="middle-section">
        <div className="history-zone">
          {groups.map(group => {
            const groupSessions = groupedSessions[group] || [];
            if (groupSessions.length === 0) return null;
            
            return (
              <div key={group} className="history-group">
                {!collapsed && <div className="group-label">{group}</div>}
                <div className="group-items">
                  {groupSessions.map(session => (
                    <div 
                      key={session.id} 
                      onClick={() => selectSession(session.id)}
                      className={`history-item ${collapsed ? 'collapsed' : ''} ${currentSessionId === session.id ? 'active' : ''} soft-surface-hover`}
                    >
                      <div className="item-icon-wrap">
                        <MessageSquare size={14} />
                      </div>
                      {!collapsed && (
                        <>
                          <div className="item-main">
                            <span className="item-title">{session.title}</span>
                          </div>
                          <div className="item-actions">
                            <button 
                              className="action-trigger"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteSession(session.id);
                              }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom Section: Alerts + Settings + Profile */}
      <div className="bottom-section">
        
        <div className="footer-links">
          <div className={`footer-item ${collapsed ? 'collapsed' : ''} soft-surface-hover`}>
            <Settings size={18} />
            {!collapsed && <span>系统设置</span>}
          </div>
        </div>

        <div className={`user-profile ${collapsed ? 'collapsed' : ''} soft-surface`}>
          <div className="avatar">
            <User size={16} />
          </div>
          {!collapsed && (
            <div className="user-info">
              <span className="user-name">Nemo Designer</span>
              <span className="user-plan">PREMIUM_PLAN</span>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .sidebar-inner {
          display: flex;
          flex-direction: column;
          height: 100%;
          padding: 24px 12px;
          gap: 24px;
          background: transparent;
          align-items: stretch;
          transition: all 0.3s;
        }
        .sidebar-inner.collapsed { align-items: center; padding: 24px 0; }

        .sidebar-inner :global(svg) { flex-shrink: 0; }
        .top-section { display: flex; flex-direction: column; gap: 24px; }
        
        .sidebar-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 12px;
        }
        .brand { display: flex; align-items: center; gap: 12px; }
        .brand-aura {
          width: 32px; height: 32px;
          background: linear-gradient(135deg, #6366f1, #a855f7);
          border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          color: white;
          box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
          position: relative;
          overflow: hidden;
        }
        .brand-aura::after {
          content: ''; position: absolute; inset: 0;
          background: linear-gradient(transparent, rgba(255,255,255,0.2));
        }
        .brand-info { display: flex; flex-direction: column; }
        .brand-name { font-size: 16px; font-weight: 900; color: var(--text-primary); letter-spacing: -0.03em; }
        .brand-tag { font-family: var(--font-mono); font-size: 8px; font-weight: 800; color: var(--accent-primary); letter-spacing: 0.1em; opacity: 0.8; }

        .toggle-btn {
          width: 36px; height: 36px;
          display: flex; align-items: center; justify-content: center;
          border-radius: 12px;
          color: var(--text-tertiary);
          transition: all 0.3s var(--spring);
          flex-shrink: 0;
        }
        .toggle-btn:hover { 
          color: var(--accent-primary); 
          background: rgba(99, 102, 241, 0.05);
          transform: scale(1.05); 
        }

        .action-area { padding: 0 8px; }
        .new-analysis-btn {
          width: 100%;
          padding: 14px;
          display: flex; align-items: center; gap: 12px;
          border-radius: 16px;
          font-size: 14px; font-weight: 700;
          color: var(--text-primary);
          position: relative;
          overflow: hidden;
          transition: all 0.4s var(--spring);
        }
        .new-analysis-btn.collapsed { width: 44px; height: 44px; padding: 0; justify-content: center; }
        .new-analysis-btn :global(svg) { flex-shrink: 0; }
        .new-analysis-btn:hover { transform: translateY(-2px); box-shadow: var(--shadow-deep); border-color: var(--accent-primary); }
        .plus-icon { color: var(--accent-primary); }
        .btn-glow {
          position: absolute; inset: 0;
          background: radial-gradient(circle at var(--x, 50%) var(--y, 50%), rgba(99, 102, 241, 0.05), transparent 70%);
          opacity: 0; transition: opacity 0.3s;
        }
        .new-analysis-btn:hover .btn-glow { opacity: 1; }

        .middle-section { flex: 1; display: flex; flex-direction: column; gap: 20px; overflow: hidden; }
        
        .history-zone {
          flex: 1;
          overflow-y: auto;
          display: flex; flex-direction: column; gap: 24px;
          padding: 0 8px;
        }
        .history-zone::-webkit-scrollbar { width: 4px; }
        .history-zone::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.05); border-radius: 2px; }

        .group-label { 
          padding: 0 12px 8px;
          font-family: var(--font-mono); font-size: 9px; font-weight: 800; 
          color: var(--text-tertiary); letter-spacing: 0.1em; text-transform: uppercase;
        }
        .group-items { display: flex; flex-direction: column; gap: 4px; }
        
        .history-item {
          display: flex; align-items: center; gap: 12px;
          padding: 10px 12px;
          border-radius: 12px;
          cursor: pointer;
          position: relative;
          transition: all 0.2s ease;
          border: 1px solid transparent;
        }
        .history-item :global(svg) { flex-shrink: 0; color: var(--text-tertiary); opacity: 0.5; transition: all 0.2s; }
        .history-item:hover :global(svg) { color: var(--accent-primary); opacity: 1; }
        .item-icon-wrap { display: flex; align-items: center; justify-content: center; width: 20px; flex-shrink: 0; }
        .history-item.collapsed { width: 40px; height: 40px; padding: 0; justify-content: center; color: var(--text-tertiary); }
        .history-item:hover { background: rgba(0,0,0,0.03); transform: translateX(4px); }
        .history-item.collapsed:hover { transform: scale(1.1); background: white; }
        .history-item.active { background: rgba(99, 102, 241, 0.08); border-color: rgba(99, 102, 241, 0.2); }
        .history-item.active :global(svg) { color: var(--accent-primary); opacity: 1; }
        .item-main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
        .item-title { 
          font-size: 13px; font-weight: 500; color: var(--text-primary); 
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          line-height: 1.4;
        }
        
        .item-actions { opacity: 0; transition: opacity 0.2s; position: absolute; right: 8px; top: 50%; transform: translateY(-50%); background: linear-gradient(90deg, transparent, var(--background) 20%); padding-left: 12px; }
        .history-item:hover .item-actions { opacity: 1; }
        .action-trigger { color: var(--text-tertiary); padding: 4px; border-radius: 6px; }
        .action-trigger:hover { color: #ef4444; background: rgba(239, 68, 68, 0.05); }
        
        .bottom-section { display: flex; flex-direction: column; gap: 12px; }
        
        .footer-links { display: flex; flex-direction: column; gap: 4px; padding: 0 8px; }
        .footer-item {
          display: flex; align-items: center; gap: 12px;
          padding: 10px 12px;
          border-radius: 12px;
          font-size: 13px; font-weight: 600;
          color: var(--text-secondary);
          cursor: pointer;
          transition: all 0.3s;
        }
        .footer-item :global(svg) { flex-shrink: 0; }
        .footer-item.collapsed { width: 40px; height: 40px; padding: 0; justify-content: center; }
        .footer-item:hover { color: var(--accent-primary); }

        .user-profile {
          margin: 0 8px;
          display: flex; align-items: center; gap: 12px;
          padding: 12px;
          border-radius: 16px;
          cursor: pointer;
          transition: all 0.3s var(--spring);
        }
        .user-profile :global(svg) { flex-shrink: 0; }
        .user-profile.collapsed { width: 44px; height: 44px; padding: 0; justify-content: center; border: none; background: transparent; box-shadow: none; }
        .user-profile:hover { transform: translateY(-2px); border-color: var(--accent-primary); }
        .avatar {
          width: 32px; height: 32px;
          background: var(--accent-flow);
          border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          color: white;
          flex-shrink: 0;
        }
        .user-info { display: flex; flex-direction: column; }
        .user-name { font-size: 13px; font-weight: 700; color: var(--text-primary); }
        .user-plan { font-family: var(--font-mono); font-size: 8px; font-weight: 800; color: var(--accent-primary); opacity: 0.8; }
      `}</style>
    </div>
  );
}
