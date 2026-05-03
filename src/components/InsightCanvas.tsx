'use client';

import React from 'react';
import InsightCard from './InsightCard';
import { Sparkles, ArrowRight } from 'lucide-react';

interface InsightCanvasProps {
  cards: any[];
}

export default function InsightCanvas({ cards }: InsightCanvasProps) {
  return (
    <div className="canvas-root">
      {cards.length === 0 ? (
        <div className="empty-zone">
          <div className="spark-box">
            <Sparkles size={32} className="spark-icon" />
          </div>
          <h4 className="empty-heading">洞察画布</h4>
          <p className="empty-sub">这里将展示 AI 生成的关键分析图表</p>
          <div className="empty-guide">
            <span>点击分析卡片上的 📌 即可固定至此</span>
          </div>
        </div>
      ) : (
        <div className="cards-stack">
          {cards.map((card, idx) => (
            <div
              key={card.id ? `canvas-card-${card.id}-${idx}` : `canvas-card-idx-${idx}`}
              className="card-reveal"
              style={{ animationDelay: `${idx * 100}ms` }}
            >
              <InsightCard {...card} compact />
            </div>
          ))}
          
          <div className="canvas-footer">
            <ArrowRight size={16} />
            <span>探索更多洞察路径</span>
          </div>
        </div>
      )}

      <style jsx>{`
        .canvas-root {
          width: 100%;
          height: 100%;
          overflow-y: auto;
          overflow-x: hidden;
          background: rgba(255,255,255,0.2);
          backdrop-filter: blur(10px);
        }

        .empty-zone {
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px;
          text-align: center;
        }
        
        .spark-box {
          width: 80px;
          height: 80px;
          background: #FFF;
          border-radius: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: var(--shadow-soft);
          margin-bottom: 24px;
        }
        .spark-icon { color: var(--accent-primary); opacity: 0.8; }
        
        .empty-heading { font-size: 18px; font-weight: 700; color: var(--text-primary); margin: 0 0 8px; }
        .empty-sub { font-size: 14px; color: var(--text-tertiary); margin: 0 0 32px; }
        
        .empty-guide {
          padding: 12px 20px;
          background: rgba(0,0,0,0.03);
          border-radius: 20px;
          font-size: 12px;
          color: var(--text-secondary);
          font-weight: 500;
        }

        .cards-stack {
          padding: 24px 20px;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .card-reveal {
          animation: reveal 0.6s cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        .canvas-footer {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 40px 20px;
          color: var(--text-tertiary);
          font-size: 13px;
          font-weight: 500;
          opacity: 0.6;
        }

        @keyframes reveal {
          from { transform: translateY(30px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        .canvas-root::-webkit-scrollbar { width: 6px; }
        .canvas-root::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.05); border-radius: 3px; }
      `}</style>
    </div>
  );
}
