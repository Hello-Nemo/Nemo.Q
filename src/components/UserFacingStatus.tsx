import React from 'react';
import { AlertCircle, CheckCircle2, Info, AlertTriangle } from 'lucide-react';
import { AskMeta } from '@/lib/ask/ask-meta';

interface UserFacingStatusProps {
  status: AskMeta['userFacingStatus'];
  className?: string;
}

export default function UserFacingStatus({ status, className = '' }: UserFacingStatusProps) {
  const config = {
    info: {
      icon: Info,
      color: 'text-blue-500 bg-blue-500/5 border-blue-500/10',
    },
    success: {
      icon: CheckCircle2,
      color: 'text-green-500 bg-green-500/5 border-green-500/10',
    },
    warning: {
      icon: AlertTriangle,
      color: 'text-amber-500 bg-amber-500/5 border-amber-500/10',
    },
    error: {
      icon: AlertCircle,
      color: 'text-red-500 bg-red-500/5 border-red-500/10',
    },
  }[status.severity];

  const Icon = config.icon;

  return (
    <div className={`flex flex-col gap-1 p-3 rounded-xl border ${config.color} ${className}`}>
      <div className="flex items-center gap-2">
        <Icon size={16} />
        <span className="font-bold text-sm">{status.title}</span>
      </div>
      <p className="text-xs opacity-80 leading-relaxed ml-6">
        {status.message}
      </p>
    </div>
  );
}
