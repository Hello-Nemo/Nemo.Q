import React from 'react';
import { ShieldCheck, Zap, AlertCircle, HelpCircle, Eye } from 'lucide-react';
import { TrustLevel } from '@/lib/ask/ask-state';

interface TrustBadgeProps {
  level: TrustLevel;
  className?: string;
}

export default function TrustBadge({ level, className = '' }: TrustBadgeProps) {
  const config = {
    trusted: {
      icon: ShieldCheck,
      text: '已认证口径',
      color: 'text-green-500 bg-green-500/10 border-green-500/20',
    },
    trusted_with_assumptions: {
      icon: Zap,
      text: '已认证指标(含假设)',
      color: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
    },
    partial: {
      icon: Eye,
      text: '部分认证',
      color: 'text-cyan-500 bg-cyan-500/10 border-cyan-500/20',
    },
    exploratory: {
      icon: HelpCircle,
      text: '探索性结果',
      color: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
    },
    needs_confirmation: {
      icon: Eye,
      text: '待确认',
      color: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20',
    },
    blocked: {
      icon: AlertCircle,
      text: '已拦截',
      color: 'text-red-500 bg-red-500/10 border-red-500/20',
    },
  }[level] || {
    icon: HelpCircle,
    text: '未知',
    color: 'text-gray-500 bg-gray-500/10 border-gray-500/20',
  };

  const Icon = config.icon;

  return (
    <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider ${config.color} ${className}`}>
      <Icon size={12} />
      <span>{config.text}</span>
    </div>
  );
}
