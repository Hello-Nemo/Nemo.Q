'use client';

import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ChevronDown, ChevronUp, BrainCircuit, Activity } from 'lucide-react';

interface ReasoningBlockProps {
  text: string;
  isActive?: boolean;
}

export default function ReasoningBlock({ text, isActive = false }: ReasoningBlockProps) {
  const [isExpanded, setIsExpanded] = useState(isActive);

  // Auto-expand when active, auto-collapse when complete
  useEffect(() => {
    setIsExpanded(isActive);
  }, [isActive]);

  return (
    <div className={`reasoning-container ${isActive ? 'is-active' : 'is-complete'}`}>
      <button 
        className="reasoning-toggle"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="toggle-left">
          <div className="icon-wrapper">
            {isActive ? <Activity size={12} className="pulse-icon" /> : <BrainCircuit size={12} />}
          </div>
          <span className="toggle-label">
            {isActive ? 'AI 正在深度思考中...' : '查看思维逻辑过程'}
          </span>
        </div>
        <div className="toggle-right">
          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </button>

      {isExpanded && (
        <div className="reasoning-content animate-slide-down">
          <div className="content-inner">
            <div className="markdown-wrapper prose-reasoning">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
              {isActive && <span className="reasoning-cursor" />}
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .reasoning-container {
          margin: 8px 0;
          border-radius: 16px;
          overflow: hidden;
          background: rgba(243, 244, 246, 0.5);
          border: 1px solid rgba(209, 213, 219, 0.3);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        .reasoning-container.is-active {
          background: rgba(99, 102, 241, 0.03);
          border-color: rgba(99, 102, 241, 0.15);
        }

        .reasoning-toggle {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          background: transparent;
          border: none;
          cursor: pointer;
          transition: background 0.2s;
        }

        .reasoning-toggle:hover {
          background: rgba(0, 0, 0, 0.02);
        }

        .toggle-left {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .icon-wrapper {
          width: 24px;
          height: 24px;
          border-radius: 8px;
          background: white;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #6b7280;
          box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }

        .is-active .icon-wrapper {
          color: #6366f1;
          background: rgba(99, 102, 241, 0.1);
          box-shadow: none;
        }

        .pulse-icon {
          animation: pulse 1.5s infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(0.9); }
        }

        .toggle-label {
          font-size: 12px;
          font-weight: 600;
          color: #6b7280;
          letter-spacing: 0.02em;
        }

        .is-active .toggle-label {
          color: #6366f1;
        }

        .toggle-right {
          color: #9ca3af;
        }

        .reasoning-content {
          border-top: 1px solid rgba(209, 213, 219, 0.2);
        }

        .content-inner {
          padding: 16px 20px 24px 50px;
        }

        .markdown-wrapper {
          font-family: var(--font-mono);
          font-size: 13px;
          line-height: 1.6;
          color: #4b5563;
          position: relative;
        }

        .reasoning-cursor {
          display: inline-block;
          width: 6px;
          height: 12px;
          background: #6366f1;
          margin-left: 4px;
          vertical-align: middle;
          animation: blink 1s infinite;
        }

        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }

        .animate-slide-down {
          animation: slideDown 0.3s ease-out;
        }

        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }

        :global(.prose-reasoning p) {
          margin-bottom: 0.8em;
        }
        :global(.prose-reasoning ul) {
          list-style-type: disc;
          padding-left: 1.2em;
          margin-bottom: 0.8em;
        }
      `}</style>
    </div>
  );
}
