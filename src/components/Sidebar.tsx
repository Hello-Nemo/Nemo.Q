'use client';

import React, { useState } from 'react';
import { 
  History, 
  Terminal, 
  ChevronLeft, 
  ChevronRight, 
  PlusCircle, 
  Database,
  Search,
  MoreHorizontal,
  Pencil,
  Trash2,
  Settings,
  User,
  LayoutGrid
} from 'lucide-react';
import AnomalyAlertOverlay from './AnomalyAlertOverlay';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  
  const sessions = [
    { id: 1, title: '分析核心忠诚客户的表现', group: '今天', time: '10:24 AM' },
    { id: 2, title: '月度客单价下降归因', group: '昨天', time: 'Yesterday' },
    { id: 3, title: '库存预警分析', group: '过去 7 天', time: '2 days ago' },
    { id: 4, title: '高价值订单分布', group: '过去 7 天', time: '5 days ago' },
  ];

  const groups = ['今天', '昨天', '过去 7 天'];

  return (
    <div className="sidebar-inner">
      {/* Top Section: Brand + New Chat */}
      <div className="top-section">
        <div className="sidebar-header">
          {!collapsed && (
            <div className="brand">
              <div className="brand-aura">
                <Database size={16} />
              </div>
              <div className="brand-info">
                <span className="brand-name">Lumina</span>
                <span className="brand-tag">INTELLIGENCE</span>
              </div>
            </div>
          )}
          <button onClick={onToggle} className="toggle-btn soft-surface">
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        <div className="action-area">
          <button className={`new-analysis-btn ${collapsed ? 'collapsed' : ''} soft-surface`}>
            <PlusCircle size={20} className="plus-icon" />
            {!collapsed && <span>开启新洞察</span>}
            <div className="btn-glow" />
          </button>
        </div>
      </div>

      {/* Middle Section: Search + History */}
      <div className="middle-section">
        {!collapsed && (
          <div className="search-box soft-surface">
            <Search size={14} className="search-icon" />
            <input 
              type="text" 
              placeholder="搜索历史..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
          </div>
        )}

        <div className="history-zone">
          {groups.map(group => {
            const groupSessions = sessions.filter(s => s.group === group);
            if (groupSessions.length === 0) return null;
            
            return (
              <div key={group} className="history-group">
                {!collapsed && <div className="group-label">{group}</div>}
                <div className="group-items">
                  {groupSessions.map(session => (
                    <div key={session.id} className={`history-item ${collapsed ? 'collapsed' : ''} soft-surface-hover`}>
                      {collapsed ? <History size={18} /> : (
                        <>
                          <div className="item-main">
                            <span className="item-title">{session.title}</span>
                          </div>
                          <div className="item-actions">
                            <button className="action-trigger"><MoreHorizontal size={14} /></button>
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
        <AnomalyAlertOverlay collapsed={collapsed} />
        
        <div className="footer-links">
          <div className={`footer-item ${collapsed ? 'collapsed' : ''} soft-surface-hover`}>
            <LayoutGrid size={18} />
            {!collapsed && <span>发现插件</span>}
          </div>
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
        }

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
          background: white;
          border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          color: var(--accent-primary);
          box-shadow: var(--shadow-soft);
          position: relative;
        }
        .brand-aura::after {
          content: ''; position: absolute; inset: -4px;
          background: var(--accent-flow); filter: blur(8px); opacity: 0.15; border-radius: 12px; z-index: -1;
        }
        .brand-info { display: flex; flex-direction: column; }
        .brand-name { font-size: 16px; font-weight: 800; color: var(--text-primary); letter-spacing: -0.02em; }
        .brand-tag { font-family: var(--font-mono); font-size: 8px; font-weight: 800; color: var(--text-tertiary); letter-spacing: 0.1em; }

        .toggle-btn {
          width: 32px; height: 32px;
          display: flex; align-items: center; justify-content: center;
          border-radius: 10px;
          color: var(--text-tertiary);
          transition: all 0.3s var(--spring);
        }
        .toggle-btn:hover { color: var(--accent-primary); transform: scale(1.05); }

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
        .new-analysis-btn.collapsed { justify-content: center; padding: 14px 0; }
        .new-analysis-btn:hover { transform: translateY(-2px); box-shadow: var(--shadow-deep); border-color: var(--accent-primary); }
        .plus-icon { color: var(--accent-primary); }
        .btn-glow {
          position: absolute; inset: 0;
          background: radial-gradient(circle at var(--x, 50%) var(--y, 50%), rgba(99, 102, 241, 0.05), transparent 70%);
          opacity: 0; transition: opacity 0.3s;
        }
        .new-analysis-btn:hover .btn-glow { opacity: 1; }

        .middle-section { flex: 1; display: flex; flex-direction: column; gap: 20px; overflow: hidden; }
        
        .search-box {
          margin: 0 8px;
          display: flex; align-items: center; gap: 10px;
          padding: 10px 16px;
          border-radius: 14px;
        }
        .search-icon { color: var(--text-tertiary); }
        .search-input {
          background: transparent;
          border: none;
          outline: none;
          font-size: 13px;
          color: var(--text-primary);
          width: 100%;
        }
        .search-input::placeholder { color: var(--text-tertiary); opacity: 0.6; }

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
          transition: all 0.3s var(--spring);
        }
        .history-item.collapsed { justify-content: center; padding: 12px 0; color: var(--text-tertiary); }
        .history-item:hover { transform: translateX(4px); }
        .item-main { flex: 1; min-width: 0; }
        .item-title { font-size: 13px; font-weight: 500; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        
        .item-actions { opacity: 0; transition: opacity 0.2s; position: relative; }
        .history-item:hover .item-actions { opacity: 1; }
        .action-trigger { color: var(--text-tertiary); padding: 4px; }
        .action-trigger:hover { color: var(--accent-primary); }
        
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
        .footer-item.collapsed { justify-content: center; padding: 12px 0; }
        .footer-item:hover { color: var(--accent-primary); }

        .user-profile {
          margin: 0 8px;
          display: flex; align-items: center; gap: 12px;
          padding: 12px;
          border-radius: 16px;
          cursor: pointer;
          transition: all 0.3s var(--spring);
        }
        .user-profile.collapsed { justify-content: center; padding: 12px 0; border: none; background: transparent; box-shadow: none; }
        .user-profile:hover { transform: translateY(-2px); border-color: var(--accent-primary); }
        .avatar {
          width: 32px; height: 32px;
          background: var(--accent-flow);
          border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          color: white;
        }
        .user-info { display: flex; flex-direction: column; }
        .user-name { font-size: 13px; font-weight: 700; color: var(--text-primary); }
        .user-plan { font-family: var(--font-mono); font-size: 8px; font-weight: 800; color: var(--accent-primary); opacity: 0.8; }
      `}</style>
    </div>
  );
}
