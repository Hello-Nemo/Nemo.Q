'use client';

import React, { useState } from 'react';
import Sidebar from './Sidebar';
import { Menu, X } from 'lucide-react';

interface WorkbenchLayoutProps {
  children: React.ReactNode;
}

export default function WorkbenchLayout({ children }: WorkbenchLayoutProps) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <div className="workbench-root">
      {/* Mobile Toggle Button */}
      <button 
        className="mobile-menu-btn" 
        onClick={() => setIsMobileOpen(true)}
        aria-label="Open Menu"
      >
        <Menu size={24} />
      </button>

      {/* Sidebar Slot */}
      <div
        className={`sidebar-slot ${isMobileOpen ? 'mobile-open' : ''} ${isSidebarCollapsed ? 'collapsed' : ''}`}
      >
        <div className="sidebar-mobile-header">
           <button onClick={() => setIsMobileOpen(false)} className="close-btn">
             <X size={20} />
           </button>
        </div>
        <Sidebar
          collapsed={isSidebarCollapsed}
          onToggle={() => {
            if (window.innerWidth <= 768) {
              setIsMobileOpen(false);
            } else {
              setIsSidebarCollapsed(!isSidebarCollapsed);
            }
          }}
        />
      </div>

      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div className="mobile-overlay" onClick={() => setIsMobileOpen(false)} />
      )}

      {/* Content Area */}
      <div className="workbench-body">
        {children}
      </div>

      <style jsx>{`
        .workbench-root {
          display: flex;
          height: 100vh;
          width: 100vw;
          overflow: hidden;
          background: var(--background);
        }
        
        .mobile-menu-btn {
          display: none;
          position: fixed;
          top: 16px;
          left: 16px;
          z-index: 40;
          background: white;
          border: 1px solid var(--surface-border);
          border-radius: 8px;
          padding: 8px;
          box-shadow: var(--shadow-small);
          color: var(--text-primary);
        }

        .sidebar-slot {
          width: 240px;
          border-right: 1px solid var(--surface-border);
          height: 100%;
          z-index: 20;
          transition: width 0.3s var(--easing);
          background: var(--background);
          flex-shrink: 0;
        }

        .sidebar-slot.collapsed {
          width: 64px;
        }

        .sidebar-mobile-header {
          display: none;
          padding: 16px;
          justify-content: flex-end;
        }

        .workbench-body {
          flex: 1;
          display: flex;
          flex-direction: row;
          height: 100%;
          overflow: hidden;
          position: relative;
          min-width: 0;
        }

        .mobile-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.4);
          backdrop-filter: blur(4px);
          z-index: 90;
        }

        @media (max-width: 768px) {
          .mobile-menu-btn {
            display: flex;
          }
          .sidebar-slot {
            position: fixed;
            left: 0;
            top: 0;
            bottom: 0;
            transform: translateX(-100%);
            width: 280px !important;
            box-shadow: 20px 0 50px rgba(0, 0, 0, 0.1);
          }
          .sidebar-slot.mobile-open {
            transform: translateX(0);
          }
          .sidebar-mobile-header {
            display: flex;
          }
          .close-btn {
            background: transparent;
            border: none;
            color: var(--text-tertiary);
          }
        }
      `}</style>
    </div>
  );
}
