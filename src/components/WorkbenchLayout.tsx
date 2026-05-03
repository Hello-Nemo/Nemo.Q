'use client';

import React, { useState } from 'react';
import Sidebar from './Sidebar';

interface WorkbenchLayoutProps {
  children: React.ReactNode;
}

export default function WorkbenchLayout({ children }: WorkbenchLayoutProps) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  return (
    <div className="workbench-root">
      {/* Left Sidebar */}
      <div
        className="sidebar-slot"
        style={{ width: isSidebarCollapsed ? '64px' : '240px' }}
      >
        <Sidebar
          collapsed={isSidebarCollapsed}
          onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        />
      </div>

      {/* Center + Right area — flex row */}
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
        .sidebar-slot {
          border-right: 1px solid var(--surface-border);
          height: 100%;
          z-index: 20;
          transition: width 0.3s var(--easing);
          background: var(--background);
          flex-shrink: 0;
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
      `}</style>
    </div>
  );
}
