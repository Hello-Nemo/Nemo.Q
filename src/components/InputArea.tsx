'use client';

import React from 'react';
import { Send, Square, Paperclip } from 'lucide-react';
import { shouldBlockComposerSubmit } from '@/lib/decision-state';
import { motion, AnimatePresence } from 'framer-motion';

interface InputAreaProps {
  isStreaming: boolean;
  isDecisionPending?: boolean;
  decisionTray?: React.ReactNode;
  onSend: (message: string) => void;
  onStop: () => void;
}

export default function InputArea({
  isStreaming,
  isDecisionPending = false,
  decisionTray,
  onSend,
  onStop,
}: InputAreaProps) {
  const [input, setInput] = React.useState('');
  const [isError, setIsError] = React.useState(false);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const shouldBlockSubmit = shouldBlockComposerSubmit({
      isStreaming,
      isDecisionPending,
      text: input,
    });

    if (!shouldBlockSubmit) {
      onSend(input);
      setInput('');
      setIsError(false);
    } else if (!input.trim() && !isStreaming) {
      setIsError(true);
      setTimeout(() => setIsError(false), 500);
    }
  };

  return (
    <div className="input-root">
      <div className={`composer-frame soft-surface ${decisionTray ? 'with-decision' : ''} ${isError ? 'shake' : ''}`}>
        <AnimatePresence>
          {decisionTray && (
            <motion.div
              initial={{ height: 0, opacity: 0, y: 10 }}
              animate={{ height: 'auto', opacity: 1, y: 0 }}
              exit={{ height: 0, opacity: 0, y: -4 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="decision-tray-wrapper"
            >
              <div className="decision-tray">
                {decisionTray}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <form onSubmit={handleSubmit} className="input-form">
          <div className="input-island">
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
              placeholder={isDecisionPending ? '回答确认，或补充你的说明...' : '与 NEMO.Q 对话...'}
              className="input-field"
              rows={1}
            />

            <div className="action-hub">
              {isStreaming ? (
                <button type="button" onClick={onStop} className="hub-btn stop" title="STOP">
                  <Square size={16} fill="currentColor" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={shouldBlockComposerSubmit({
                    isStreaming,
                    isDecisionPending,
                    text: input,
                  })}
                  className={`hub-btn send ${input.trim() ? 'active' : ''}`}
                  title="SEND"
                >
                  <Send size={20} />
                </button>
              )}
            </div>
          </div>
        </form>

        <div className={`island-aura ${input.trim() ? 'glow' : ''}`} />
      </div>

      <style jsx>{`
        .input-root { width: 100%; display: flex; flex-direction: column; align-items: center; }
        .composer-frame {
          width: 100%;
          position: relative;
          overflow: visible;
          border-radius: 22px;
          background: rgba(255, 255, 255, 0.65);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          transition: transform 0.14s ease-out, border-color 0.14s ease-out, box-shadow 0.14s ease-out, background 0.14s ease-out;
        }
        .composer-frame:focus-within {
          transform: translateY(-1px);
          box-shadow: var(--shadow-deep);
          background: rgba(255, 255, 255, 0.85);
        }
        .composer-frame.with-decision {
          border-color: rgba(255, 92, 0, 0.25);
          box-shadow: 0 20px 48px -20px rgba(255, 92, 0, 0.15), 0 0 0 1px rgba(255, 92, 0, 0.02);
          background: linear-gradient(to bottom, rgba(255, 255, 255, 0.85), rgba(255, 255, 255, 0.7));
        }
        .input-form { width: 100%; position: relative; }
        .decision-tray-wrapper {
          width: 100%;
          position: relative;
          z-index: 2;
          overflow: hidden;
        }
        .decision-tray {
          padding: 8px 10px 0;
        }
        .decision-tray :global(.decision-prompt) {
          max-width: none;
        }
        
        .input-island {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 12px 16px 12px 24px;
          min-height: 72px;
          background: transparent;
          border-radius: inherit;
          transition: min-height 0.12s ease-out, padding 0.12s ease-out;
        }

        .with-decision .input-island {
          min-height: 64px;
          padding: 10px 14px 12px 18px;
          border-top: 1px dashed rgba(255, 92, 0, 0.15);
          background: rgba(255, 92, 0, 0.015);
          border-bottom-left-radius: 22px;
          border-bottom-right-radius: 22px;
        }
        .input-island:focus-within {
          transform: none;
          box-shadow: none;
          background: transparent;
        }

        .util-btn { color: var(--text-tertiary); padding: 8px; transition: color 0.12s ease-out, background 0.12s ease-out; }
        .util-btn:hover { color: var(--accent-primary); background: rgba(255, 92, 0, 0.05); border-radius: 50%; }

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
          transition: transform 0.12s ease-out, background 0.12s ease-out, color 0.12s ease-out, box-shadow 0.12s ease-out;
        }
        
        .hub-btn.send { background: rgba(0,0,0,0.03); color: var(--text-tertiary); }
        .hub-btn.send.active { 
          background: #FF5C00; 
          color: white; 
          box-shadow: 0 8px 24px rgba(255, 92, 0, 0.2); 
        }
        .hub-btn.send.active:hover { 
          transform: scale(1.04);
          box-shadow: 0 12px 30px rgba(255, 92, 0, 0.3);
        }

        .hub-btn.stop { 
          background: #0F172A; 
          color: white; 
          box-shadow: 0 8px 20px rgba(0,0,0,0.1); 
        }
        .hub-btn.stop:hover {
          background: #EF4444;
          transform: scale(1.08);
        }

        .island-aura {
          position: absolute;
          inset: -2px;
          background: var(--accent-flow);
          filter: blur(24px);
          opacity: 0;
          z-index: -1;
          transition: opacity 1s cubic-bezier(0.4, 0, 0.2, 1);
          border-radius: 20px;
        }
        .island-aura.glow { opacity: 0.15; }

        .shake { animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both; }
        @keyframes shake {
          10%, 90% { transform: translate3d(-1px, 0, 0); }
          20%, 80% { transform: translate3d(2px, 0, 0); }
          30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
          40%, 60% { transform: translate3d(4px, 0, 0); }
        }

        @media (max-width: 640px) {
          .composer-frame {
            border-radius: 18px;
          }

          .decision-tray {
            padding: 8px 8px 0;
          }

          .with-decision .input-island {
            min-height: 60px;
            gap: 8px;
            padding: 9px 10px 10px 12px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .decision-tray,
          .composer-frame,
          .shake {
            animation: none;
            transition: none;
          }
        }
      `}</style>
    </div>
  );
}
