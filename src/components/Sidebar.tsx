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
import Logo from './Logo';
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

  const groupedSessions: any = {};
  sessions.forEach(s => {
    const group = getGroup(s.updatedAt);
    if (!groupedSessions[group]) groupedSessions[group] = [];
    groupedSessions[group].push(s);
  });

  const groups = ['今天', '昨天', '较早前'];

  const showPlaceholderAlert = (feature: string) => {
    alert(feature + " 功能开发中，敬请期待！");
  };

  return (
    <div className={`sidebar-inner ${collapsed ? 'collapsed' : ''}`}>
      {/* 
        NOTE: I've removed 'style jsx' from this component to debug a persistent syntax error.
        The styles are now expected to be in globals.css or injected via WorkbenchLayout.
      */}
      <div className="top-section">
        <div className="sidebar-header">
          {collapsed ? (
            <button onClick={onToggle} className="logo-toggle-btn" aria-label="Toggle Sidebar">
              <Logo size={24} showText={false} />
            </button>
          ) : (
            <div className="sidebar-header-expanded">
              <div className="brand">
                <Logo size={28} showText={true} />
              </div>
              <button onClick={onToggle} className="toggle-btn soft-surface" aria-label="Collapse Sidebar">
                <PanelLeftClose size={18} />
              </button>
            </div>
          )}
        </div>

        <div className="action-area">
          <button 
            onClick={() => createSession()}
            className={`new-analysis-btn ${collapsed ? 'collapsed' : ''} soft-surface`}
          >
            <div className="btn-icon-wrap">
              <PlusCircle size={20} className="plus-icon" />
            </div>
            {!collapsed && (
              <div className="btn-text-wrap">
                <span>开启新洞察</span>
              </div>
            )}
          </button>
        </div>
      </div>

      <div className="middle-section">
        <div className="history-zone">
          {groups.map(group => {
            const groupSessions = groupedSessions[group] || [];
            if (groupSessions.length === 0) return null;
            
            return (
              <div key={group} className="history-group">
                {!collapsed && <div className="group-label">{group}</div>}
                <div className="group-items">
                  {groupSessions.map((session: any) => (
                    <div 
                      key={session.id} 
                      onClick={() => selectSession(session.id)}
                      className={`history-item ${collapsed ? 'collapsed' : ''} ${currentSessionId === session.id ? 'active' : ''} soft-surface-hover`}
                    >
                      <div className="item-icon-wrap">
                        <MessageSquare size={14} />
                      </div>
                      {!collapsed && (
                        <div className="item-content-wrap">
                          <div className="item-main">
                            <span className="item-title">{session.title}</span>
                          </div>
                          <div className="item-actions">
                            <button 
                              className="action-trigger"
                              aria-label="Delete Session"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteSession(session.id);
                              }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bottom-section">
        <div className="footer-links">
          <div 
            className={`footer-item ${collapsed ? 'collapsed' : ''} soft-surface-hover`}
            onClick={() => showPlaceholderAlert('系统设置')}
          >
            <Settings size={18} />
            {!collapsed && <span>系统设置</span>}
          </div>
        </div>

        <div 
          className={`user-profile ${collapsed ? 'collapsed' : ''} soft-surface`}
          onClick={() => showPlaceholderAlert('个人资料')}
        >
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
    </div>
  );
}
