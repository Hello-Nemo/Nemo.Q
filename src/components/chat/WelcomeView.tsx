'use client';

import React from 'react';
import Logo from '@/components/Logo';
import { SUGGESTED_QUESTIONS } from '@/lib/chat-constants';

interface WelcomeViewProps {
  /**
   * 当用户点击建议问题时触发的消息发送回调
   */
  onSendMessage: (params: { text: string }) => void;
}

/**
 * 欢迎界面组件
 * 展示 NEMO.Q 品牌 Logo、标语以及建议探索的问题列表
 */
export default function WelcomeView({ onSendMessage }: WelcomeViewProps) {
  return (
    <div className="welcome-root">
      <div className="welcome-inner animate-fade-in">
        {/* 顶部品牌展示区域 */}
        <div className="header-box">
          <div className="hero-brand-unit">
            <Logo size={100} showText={false} className="hero-logo-main" />
            <div className="hero-title-group">
              <span className="hero-name">NEMO</span>
              <span className="hero-dot-q">.Q</span>
            </div>
          </div>
          
          {/* 动态扫描线装饰效果 */}
          <div className="hero-scan-area">
            <div className="scanline" />
          </div>
        </div>

        {/* 标语和副标题 */}
        <div className="hero-section">
          <h2 className="hero-title">
            <span className="gradient-text">探索数据</span><span className="hero-title-rest">的无限可能</span>
          </h2>
          <p className="hero-subtitle">Precision In, Truth Out. 让 AI 助您洞察业务核心。</p>
        </div>

        {/* 建议问题模板网格 */}
        <div className="templates-section">
          <div className="template-grid">
            {SUGGESTED_QUESTIONS.map((q) => (
              <button 
                key={q} 
                onClick={() => onSendMessage({ text: q })} 
                className="template-pill soft-surface"
              >
                <span className="q-text">{q}</span>
                <div className="q-hover-aura" />
              </button>
            ))}
          </div>
        </div>
      </div>

      <style jsx>{`
        .welcome-root { 
          display: flex; 
          align-items: center; 
          justify-content: center; 
          min-height: 100%; 
          padding: 80px 20px; 
          position: relative; 
          overflow-y: auto; 
        }
        .welcome-inner { 
          width: 100%; 
          max-width: 840px; 
          display: flex; 
          flex-direction: column; 
          gap: 48px; 
          align-items: center; 
          text-align: center; 
        }
        
        .header-box { display: flex; flex-direction: column; align-items: center; gap: 16px; }
        
        .hero-brand-unit {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 32px;
          padding: 24px;
          margin-bottom: 0;
          white-space: nowrap;
        }

        @media (max-width: 640px) {
          .hero-brand-unit {
            flex-direction: column;
            gap: 16px;
          }
          .hero-name { font-size: 72px !important; }
          .hero-dot-q { font-size: 56px !important; }
        }

        .hero-logo-main {
          filter: drop-shadow(0 0 40px rgba(255, 92, 0, 0.3));
          animation: logo-float 6s ease-in-out infinite;
        }

        @keyframes logo-float {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-12px) rotate(2deg); }
        }

        .hero-title-group {
          display: flex;
          align-items: baseline;
          flex-shrink: 0;
        }

        .hero-name {
          font-size: 120px;
          font-weight: 900;
          letter-spacing: -0.07em;
          color: var(--text-primary);
          line-height: 0.9;
          margin: 0;
          filter: drop-shadow(0 10px 20px rgba(0,0,0,0.05));
        }

        .hero-dot-q {
          font-size: 90px;
          font-weight: 900;
          color: #FF5C00;
          line-height: 0.9;
          margin-left: 2px;
        }

        .hero-scan-area {
          position: absolute;
          top: -20px; left: 0; width: 100%; height: calc(100% + 40px);
          pointer-events: none;
          z-index: 5;
          overflow: hidden;
        }

        .scanline {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 2px;
          background: linear-gradient(to right, transparent, #FF5C00, transparent);
          box-shadow: 0 0 25px rgba(255, 92, 0, 0.5);
          animation: scan 6s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }

        @keyframes scan {
          0% { top: 0%; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }

        .hero-section { display: flex; flex-direction: column; gap: 20px; }
        .hero-title { font-size: 64px; font-weight: 800; letter-spacing: -0.05em; color: var(--text-primary); line-height: 1.1; }
        .gradient-text { background: var(--accent-flow); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .hero-subtitle { font-size: 20px; color: var(--text-secondary); max-width: 520px; margin: 0 auto; opacity: 0.8; }

        .templates-section { width: 100%; }
        .template-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; width: 100%; }
        .template-pill { 
          padding: 28px; 
          text-align: left; 
          position: relative; 
          overflow: hidden; 
          transition: all 0.5s var(--spring); 
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .template-pill:hover { 
          transform: translateY(-6px) scale(1.02); 
          box-shadow: var(--shadow-deep); 
          border-color: var(--accent-primary); 
          background: #FFF; 
        }
        .q-text { font-size: 16px; font-weight: 600; color: var(--text-primary); z-index: 2; position: relative; }
        .q-hover-aura { 
          position: absolute; inset: 0; 
          background: radial-gradient(circle at var(--x, 50%) var(--y, 50%), rgba(255, 92, 0, 0.08), transparent 70%);
          opacity: 0; 
          transition: opacity 0.4s;
        }
        .template-pill:hover .q-hover-aura { opacity: 1; }
      `}</style>
    </div>
  );
}
