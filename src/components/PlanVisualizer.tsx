'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Database, 
  ArrowRight, 
  Layers, 
  Filter, 
  Activity, 
  ChevronRight,
  GitMerge,
  Table,
  CheckCircle2,
  Box
} from 'lucide-react';
import { Lineage } from '../../skills/nemo-q/lib/semantic/types';

interface PlanVisualizerProps {
  lineage: Lineage;
  explanation?: string;
}

export default function PlanVisualizer({ lineage, explanation }: PlanVisualizerProps) {
  const { path, metrics, dimensions, isMultiPass, type } = lineage;

  return (
    <div className="plan-visualizer">
      <div className="visualizer-header">
        <div className="type-badge">
          <Activity size={12} />
          <span>{(type || 'plan').toUpperCase()}</span>
        </div>
        {isMultiPass && (
          <div className="feature-badge multi-pass">
            <GitMerge size={10} />
            <span>MULTI_PASS_CTE</span>
          </div>
        )}
      </div>

      <div className="flow-container">
        {/* Step 1: Sources */}
        <div className="flow-step">
          <div className="step-label">数据源实体</div>
          <div className="entity-stack">
            {path.map((entityId, idx) => (
              <motion.div 
                key={entityId}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="entity-card"
              >
                <div className="entity-icon">
                  <Database size={14} />
                </div>
                <span className="entity-name">{entityId}</span>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="flow-connector">
          <motion.div 
            animate={{ x: [0, 10, 0] }}
            transition={{ repeat: Infinity, duration: 2 }}
          >
            <ArrowRight size={16} className="connector-arrow" />
          </motion.div>
        </div>

        {/* Step 2: Logic/Processor */}
        <div className="flow-step">
          <div className="step-label">编译策略</div>
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="logic-hub"
          >
            <div className="logic-node">
              <div className="node-icon">
                <GitMerge size={16} />
              </div>
              <div className="node-info">
                <span className="node-title">{isMultiPass ? '多事实表缝合' : '单路径关联'}</span>
                <span className="node-desc">{isMultiPass ? '基于公用表表达式(CTE)执行' : '使用 Dijkstra 最优路径'}</span>
              </div>
            </div>
            
            <div className="logic-details">
              <div className="detail-item">
                <Filter size={12} />
                <span>维度聚合对齐</span>
              </div>
              <div className="detail-item">
                <CheckCircle2 size={12} />
                <span>自动去重校验</span>
              </div>
            </div>
          </motion.div>
        </div>

        <div className="flow-connector">
          <motion.div 
            animate={{ x: [0, 10, 0] }}
            transition={{ repeat: Infinity, duration: 2, delay: 0.5 }}
          >
            <ArrowRight size={16} className="connector-arrow" />
          </motion.div>
        </div>

        {/* Step 3: Outputs */}
        <div className="flow-step">
          <div className="step-label">输出资产</div>
          <div className="output-stack">
            <div className="asset-group">
              <span className="group-label">指标</span>
              <div className="asset-list">
                {metrics.map(m => (
                  <div key={m} className="asset-item metric">
                    <Activity size={10} />
                    <span>{m}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="asset-group">
              <span className="group-label">维度</span>
              <div className="asset-list">
                {dimensions.map(d => (
                  <div key={d} className="asset-item dimension">
                    <Box size={10} />
                    <span>{d}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {explanation && (
        <div className="explanation-bubble">
          <div className="bubble-arrow" />
          <p>{explanation}</p>
        </div>
      )}

      <style jsx>{`
        .plan-visualizer {
          padding: 16px;
          background: rgba(248, 250, 252, 0.5);
          border-radius: 12px;
          border: 1px dashed var(--surface-border-strong);
        }

        .visualizer-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 20px;
        }

        .type-badge {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 3px 8px;
          background: var(--surface-border-strong);
          border-radius: 4px;
          font-family: var(--font-mono);
          font-size: 9px;
          font-weight: 800;
          color: var(--text-secondary);
        }

        .feature-badge {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 3px 8px;
          background: rgba(139, 92, 246, 0.1);
          color: #8B5CF6;
          border-radius: 4px;
          font-family: var(--font-mono);
          font-size: 9px;
          font-weight: 800;
        }

        .flow-container {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          position: relative;
        }

        .flow-step {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .step-label {
          font-size: 10px;
          font-weight: 800;
          color: var(--text-tertiary);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .entity-stack {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .entity-card {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          background: #FFFFFF;
          border: 1px solid #E2E8F0;
          border-radius: 8px;
          box-shadow: 0 1px 2px rgba(0,0,0,0.02);
        }

        .entity-icon { color: var(--accent-primary); }
        .entity-name { font-size: 12px; font-weight: 700; color: #334155; }

        .flow-connector {
          padding-top: 40px;
          color: var(--text-tertiary);
          opacity: 0.5;
        }

        .logic-hub {
          background: #FFFFFF;
          border: 1px solid var(--accent-primary);
          border-radius: 12px;
          padding: 12px;
          box-shadow: 0 4px 12px rgba(99, 102, 241, 0.05);
        }

        .logic-node {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 12px;
        }

        .node-icon {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: rgba(99, 102, 241, 0.1);
          color: var(--accent-primary);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .node-info { display: flex; flex-direction: column; }
        .node-title { font-size: 13px; font-weight: 800; color: var(--text-primary); }
        .node-desc { font-size: 10px; color: var(--text-tertiary); }

        .logic-details {
          display: flex;
          flex-direction: column;
          gap: 6px;
          padding-top: 10px;
          border-top: 1px solid #F1F5F9;
        }

        .detail-item {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          color: var(--text-secondary);
          font-weight: 600;
        }

        .output-stack {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .asset-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .group-label { font-size: 9px; font-weight: 800; color: var(--text-tertiary); }
        .asset-list { display: flex; flex-wrap: wrap; gap: 4px; }
        
        .asset-item {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 700;
        }

        .asset-item.metric { background: rgba(99, 102, 241, 0.05); color: var(--accent-primary); border: 1px solid rgba(99, 102, 241, 0.1); }
        .asset-item.dimension { background: rgba(139, 92, 246, 0.05); color: #8B5CF6; border: 1px solid rgba(139, 92, 246, 0.1); }

        .explanation-bubble {
          margin-top: 20px;
          background: var(--surface-border-strong);
          padding: 12px 16px;
          border-radius: 12px;
          position: relative;
        }

        .explanation-bubble p {
          font-size: 12px;
          line-height: 1.6;
          color: var(--text-secondary);
          margin: 0;
        }

        @media (max-width: 640px) {
          .flow-container { flex-direction: column; gap: 20px; }
          .flow-connector { transform: rotate(90deg); padding: 0; align-self: center; }
          .flow-step { width: 100%; }
        }
      `}</style>
    </div>
  );
}
