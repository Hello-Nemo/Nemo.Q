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
          gap: 12px;
          padding: 10px 18px;
          background: rgba(255, 255, 255, 0.8);
          border: 1px solid var(--surface-border-strong);
          border-radius: 12px;
          width: fit-content;
          animation: fade-in 0.3s ease-out;
          box-shadow: var(--card-shadow);
          margin-top: 8px;
        }

        .pulse-dot {
          width: 6px;
          height: 6px;
          background: var(--novapulse);
          border-radius: 50%;
          box-shadow: 0 0 8px var(--novapulse-glow);
          animation: pulse 1.5s infinite ease-in-out;
        }

        .text-anim {
          display: flex;
          align-items: baseline;
          gap: 2px;
        }

        .mono {
          font-family: var(--font-mono);
          font-size: 10px;
          font-weight: 800;
          color: var(--text-secondary);
          letter-spacing: 0.1em;
        }

        .dots {
          font-family: var(--font-mono);
          font-size: 10px;
          font-weight: 800;
          color: var(--novapulse);
          animation: blink 1.2s infinite;
        }

        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(1.4); opacity: 1; }
        }

        @keyframes blink {
          0%, 100% { opacity: 0; }
          50% { opacity: 1; }
        }

        @keyframes fade-in {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
