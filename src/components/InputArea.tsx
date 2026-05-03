'use client';

import React from 'react';
import { Send, Square, Paperclip, Zap } from 'lucide-react';

interface InputAreaProps {
  isLoading: boolean;
  onSend: (message: string) => void;
  onStop: () => void;
}

export default function InputArea({ isLoading, onSend, onStop }: InputAreaProps) {
  const [input, setInput] = React.useState('');

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (input.trim() && !isLoading) {
      onSend(input);
      setInput('');
    }
  };

  return (
    <div className="input-root">
      <form onSubmit={handleSubmit} className="input-form">
        <div className="input-island soft-surface">
          <button type="button" className="util-btn" title="ATTACH">
            <Paperclip size={20} />
          </button>
          
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder="与 Lumina 对话..."
            className="input-field"
            rows={1}
          />

          <div className="action-hub">
            {isLoading ? (
              <button type="button" onClick={onStop} className="hub-btn stop" title="STOP">
                <Square size={16} fill="currentColor" />
              </button>
            ) : (
              <button 
                type="submit" 
                disabled={!input.trim()} 
                className={`hub-btn send ${input.trim() ? 'active' : ''}`}
                title="SEND"
              >
                <Send size={20} />
              </button>
            )}
          </div>
        </div>
        
        {/* Decorative Aura */}
        <div className={`island-aura ${input.trim() ? 'glow' : ''}`} />
      </form>

      <style jsx>{`
        .input-root { width: 100%; display: flex; flex-direction: column; align-items: center; }
        .input-form { width: 100%; position: relative; }
        
        .input-island {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 12px 16px 12px 24px;
          min-height: 72px;
          transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .input-island:focus-within {
          transform: translateY(-4px) scale(1.01);
          box-shadow: var(--shadow-deep);
          background: #FFF;
        }

        .util-btn { color: var(--text-tertiary); padding: 8px; transition: all 0.3s; }
        .util-btn:hover { color: var(--accent-primary); background: rgba(99, 102, 241, 0.05); border-radius: 50%; }

        .input-field {
          flex: 1;
          border: none;
          outline: none;
          resize: none;
          font-family: var(--font-body);
          font-size: 16px;
          font-weight: 500;
          color: var(--text-primary);
          background: transparent;
          padding: 8px 0;
          min-height: 24px;
          max-height: 200px;
          line-height: 1.5;
        }
        .input-field::placeholder { color: var(--text-tertiary); opacity: 0.6; }

        .action-hub { display: flex; align-items: center; }
        .hub-btn {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        
        .hub-btn.send { background: rgba(0,0,0,0.03); color: var(--text-tertiary); }
        .hub-btn.send.active { 
          background: var(--text-primary); 
          color: white; 
          box-shadow: 0 8px 20px rgba(0,0,0,0.1); 
        }
        .hub-btn.send.active:hover { transform: scale(1.1); }

        .hub-btn.stop { background: var(--critical); color: white; box-shadow: 0 8px 20px rgba(239, 68, 68, 0.2); }

        .island-aura {
          position: absolute;
          inset: -20px;
          background: var(--accent-flow);
          filter: blur(40px);
          opacity: 0;
          z-index: -1;
          transition: opacity 0.8s ease;
          border-radius: 40px;
        }
        .island-aura.glow { opacity: 0.1; }
      `}</style>
    </div>
  );
}
