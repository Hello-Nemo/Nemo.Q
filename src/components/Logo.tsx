'use client';

import React from 'react';

interface LogoProps {
  size?: number;
  showText?: boolean;
  className?: string;
}

export default function Logo({ size = 32, showText = false, className = "" }: LogoProps) {
  const accentColor = "#FF5C00"; // 警戒橙

  return (
    <div className={`nemo-floating-logo ${className}`} style={{ height: size }}>
      <div className="icon-unit" style={{ width: size, height: size }}>
        <svg
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="master-svg"
        >
          {/* N 的几何表达 */}
          <path
            d="M20 80 V 20 L 50 50"
            stroke="currentColor"
            strokeWidth="10"
            strokeLinecap="round"
          />
          
          {/* Q 的几何表达 */}
          <rect
            x="45" y="25" width="45" height="45"
            stroke={accentColor}
            strokeWidth="10"
            strokeLinecap="round"
          />

          {/* Q 的锐利尾部 */}
          <path
            d="M80 70 L95 85"
            stroke={accentColor}
            strokeWidth="10"
            strokeLinecap="round"
          />
        </svg>
      </div>

      {showText && (
        <div className="text-unit">
          <div className="brand-name">
            <span className="nemo">NEMO</span>
            <span className="dot">.</span>
            <span className="q">Q</span>
          </div>
        </div>
      )}

      <style jsx>{`
        .nemo-floating-logo {
          display: flex;
          align-items: center;
          gap: 12px;
          cursor: pointer;
        }

        .icon-unit {
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .master-svg {
          width: 100%;
          height: 100%;
          overflow: visible;
        }

        .nemo-floating-logo:hover .icon-unit {
          transform: scale(1.1);
        }

        .text-unit {
          display: flex;
          flex-direction: column;
          line-height: 1;
        }

        .brand-name {
          display: flex;
          align-items: baseline;
          font-family: var(--font-inter), sans-serif;
          white-space: nowrap;
        }

        .nemo {
          font-size: 20px;
          font-weight: 800;
          color: var(--text-primary);
          letter-spacing: -0.04em;
        }

        .dot {
          color: ${accentColor};
          font-size: 20px;
          font-weight: 900;
          margin: 0 1px;
        }

        .q {
          color: ${accentColor};
          font-size: 20px;
          font-weight: 900;
          letter-spacing: -0.04em;
        }
      `}</style>
    </div>
  );
}
