import React from 'react';
import { ArrowRight, RotateCcw, Search, PlusCircle, Shield, Settings2 } from 'lucide-react';
import { RecoveryAction } from '@/lib/ask/ask-meta';

interface RecoveryActionPanelProps {
  actions: RecoveryAction[];
  onAction?: (action: RecoveryAction) => void;
  className?: string;
}

export default function RecoveryActionPanel({ actions, onAction, className = '' }: RecoveryActionPanelProps) {
  if (actions.length === 0) return null;

  const getIcon = (type: string) => {
    switch (type) {
      case 'use_certified_metric':
      case 'use_similar_metric':
        return Search;
      case 'request_certification':
        return PlusCircle;
      case 'switch_to_aggregate':
      case 'retry_safely':
        return Shield;
      case 'adjust_filters':
        return Settings2;
      case 'confirm_plan':
        return ArrowRight;
      case 'cancel_plan':
        return RotateCcw;
      default:
        return ArrowRight;
    }
  };

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <div className="text-[10px] font-bold text-secondary uppercase tracking-widest px-1">
        推荐操作 / RECOMMENDED_ACTIONS
      </div>
      <div className="flex flex-wrap gap-2">
        {actions.map((action, idx) => {
          const Icon = getIcon(action.type);
          return (
            <button
              key={idx}
              onClick={() => onAction?.(action)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface border border-border hover:border-accent-primary hover:bg-accent-primary/5 transition-all group"
            >
              <Icon size={14} className="text-secondary group-hover:text-accent-primary" />
              <div className="flex flex-col items-start">
                <span className="text-xs font-semibold">{action.label}</span>
                {action.description && (
                  <span className="text-[10px] text-secondary">{action.description}</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
