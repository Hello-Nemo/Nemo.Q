'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Terminal, ShieldCheck, AlertTriangle, Copy, Check } from 'lucide-react';

interface SqlAuditPanelProps {
  explanation: string;
  assumptions: { text: string; critical: boolean }[];
  sql: string;
}

export default function SqlAuditPanel({ explanation, assumptions, sql }: SqlAuditPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full border border-[var(--surface-border)] rounded-xl overflow-hidden transition-all duration-300">
      {/* Trigger Row */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between bg-[var(--background)] hover:bg-[var(--surface-border)] transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-[var(--novapulse)]" />
          <span className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">取数逻辑审计</span>
        </div>
        {isOpen ? <ChevronUp size={16} className="text-[var(--text-tertiary)]" /> : <ChevronDown size={16} className="text-[var(--text-tertiary)]" />}
      </button>

      {/* Expanded Content */}
      {isOpen && (
        <div className="p-5 bg-[#1E1E2E] text-[#D9E0EE] space-y-6 animate-entry">
          {/* Natural Language Explanation */}
          <div>
            <div className="flex items-center gap-2 mb-2 text-[#CBA6F7]">
              <ShieldCheck size={16} />
              <span className="text-[11px] font-bold uppercase tracking-widest">取数逻辑</span>
            </div>
            <p className="text-sm leading-relaxed opacity-90">
              {explanation}
            </p>
          </div>

          {/* Business Assumptions */}
          <div>
            <div className="flex items-center gap-2 mb-2 text-[#FAB387]">
              <AlertTriangle size={16} />
              <span className="text-[11px] font-bold uppercase tracking-widest">业务假设</span>
            </div>
            <ul className="space-y-2">
              {assumptions.map((item, idx) => (
                <li key={idx} className="flex items-start gap-3 group">
                  <div className={`mt-1 flex-shrink-0 ${item.critical ? 'text-[#F38BA8]' : 'text-[#FAB387]'}`}>
                    ●
                  </div>
                  <div className="flex-1 flex items-center justify-between">
                    <span className="text-xs opacity-80">{item.text}</span>
                    <button className="text-[9px] font-bold text-[#89DCEB] opacity-0 group-hover:opacity-100 transition-opacity hover:underline">
                      纠正此假设
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* SQL Source */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-[#A6E3A1]">
                <Terminal size={16} />
                <span className="text-[11px] font-bold uppercase tracking-widest">SQL 源码</span>
              </div>
              <button 
                onClick={handleCopy}
                className="p-1.5 hover:bg-white/10 rounded-md transition-colors text-[#94A3B8]"
              >
                {copied ? <Check size={14} className="text-[#A6E3A1]" /> : <Copy size={14} />}
              </button>
            </div>
            <div className="relative">
              <pre className="p-4 bg-[#181825] rounded-lg overflow-x-auto text-xs font-mono border border-white/5">
                <code className="text-[#89DCEB]">{sql}</code>
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
