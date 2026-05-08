'use client';

import React from 'react';

export default function ThinkingIndicator() {
  return (
    <div className="thinking-root">
      <div className="pulse-dot" />
      <div className="text-anim">
        <span className="mono">AGENT_THINKING</span>
        <span className="dots">...</span>
      </div>

      <style jsx>{`
        .thinking-root {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 12px 20px;
          background: rgba(255, 255, 255, 0.4);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 92, 0, 0.2);
          border-radius: 16px;
          width: fit-content;
          animation: fade-in 0.5s cubic-bezier(0.16, 1, 0.3, 1);
          box-shadow: 0 8px 32px rgba(255, 92, 0, 0.05);
          margin-top: 12px;
          position: relative;
          overflow: hidden;
        }

        .thinking-root::after {
          content: "";
          position: absolute;
          left: -100%;
          top: 0;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255, 92, 0, 0.05), transparent);
          animation: sweep 2s infinite linear;
        }

        @keyframes sweep {
          0% { left: -100%; }
          100% { left: 100%; }
        }

        .pulse-dot {
          width: 8px;
          height: 8px;
          background: #FF5C00;
          border-radius: 50%;
          box-shadow: 0 0 12px rgba(255, 92, 0, 0.5);
          animation: pulse 2s infinite cubic-bezier(0.4, 0, 0.6, 1);
        }

        .text-anim {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .mono {
          font-family: var(--font-mono);
          font-size: 11px;
          font-weight: 800;
          color: var(--text-primary);
          letter-spacing: 0.15em;
          text-transform: uppercase;
        }

        .dots {
          font-family: var(--font-mono);
          font-size: 11px;
          font-weight: 800;
          color: #FF5C00;
          animation: blink 1.4s infinite;
        }

        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 0.5; box-shadow: 0 0 0 rgba(255, 92, 0, 0); }
          50% { transform: scale(1.3); opacity: 1; box-shadow: 0 0 15px rgba(255, 92, 0, 0.6); }
        }

        @keyframes blink {
          0%, 20%, 80%, 100% { opacity: 0; }
          40%, 60% { opacity: 1; }
        }

        @keyframes fade-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
