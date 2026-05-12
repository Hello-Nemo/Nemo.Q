'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Zap, Sparkles, ChevronDown, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ModelSwitcherProps {
  model: string;
  onChange: (model: string) => void;
}

export default function ModelSwitcher({ model, onChange }: ModelSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = (selected: string) => {
    onChange(selected);
    setIsOpen(false);
  };

  const isPro = model === 'deepseek-v4-pro';

  return (
    <div className="model-switcher-root" ref={menuRef}>
      <button 
        className={`trigger-btn ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="trigger-title">
          {isPro ? 'DeepSeek' : 'DeepSeek'}
        </span>
        <span className={`trigger-badge ${isPro ? 'pro' : 'flash'}`}>
          {isPro ? 'Pro' : 'Flash'}
        </span>
        <ChevronDown size={16} className={`chevron ${isOpen ? 'open' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            className="dropdown-menu"
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
          >
            <div className="menu-group-label">模型选择</div>
            
            <button 
              className="menu-item"
              onClick={() => handleSelect('deepseek-v4-pro')}
            >
              <div className="item-icon pro">
                <Sparkles size={18} />
              </div>
              <div className="item-content">
                <div className="item-title">DeepSeek Pro</div>
                <div className="item-desc">深度推理，适合复杂逻辑与长上下文</div>
              </div>
              {isPro && <Check size={18} className="check-icon" />}
            </button>

            <button 
              className="menu-item"
              onClick={() => handleSelect('deepseek-v4-flash')}
            >
              <div className="item-icon flash">
                <Zap size={18} />
              </div>
              <div className="item-content">
                <div className="item-title">DeepSeek Flash</div>
                <div className="item-desc">极速响应，适合日常提问与轻量级任务</div>
              </div>
              {!isPro && <Check size={18} className="check-icon" />}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <style jsx>{`
        .model-switcher-root {
          position: relative;
          display: inline-block;
          z-index: 50;
        }

        .trigger-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          border-radius: 12px;
          background: transparent;
          border: none;
          cursor: pointer;
          transition: background 0.2s ease;
        }

        .trigger-btn:hover, .trigger-btn.active {
          background: rgba(0, 0, 0, 0.05);
        }

        .trigger-title {
          font-size: 18px;
          font-weight: 700;
          color: var(--text-primary);
          letter-spacing: -0.02em;
        }

        .trigger-badge {
          font-size: 14px;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 8px;
          letter-spacing: 0.02em;
        }

        .trigger-badge.pro {
          color: #FF5C00;
          background: rgba(255, 92, 0, 0.1);
        }

        .trigger-badge.flash {
          color: #2563EB;
          background: rgba(37, 99, 235, 0.1);
        }

        .chevron {
          color: var(--text-tertiary);
          transition: transform 0.2s ease;
        }

        .chevron.open {
          transform: rotate(180deg);
        }

        .dropdown-menu {
          position: absolute;
          top: calc(100% + 8px);
          left: 0;
          width: 320px;
          background: white;
          border-radius: 16px;
          box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.04);
          border: 1px solid var(--surface-border);
          padding: 8px;
          overflow: hidden;
        }

        .menu-group-label {
          font-size: 11px;
          font-weight: 700;
          color: var(--text-tertiary);
          padding: 8px 12px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .menu-item {
          display: flex;
          align-items: center;
          width: 100%;
          padding: 12px;
          border-radius: 12px;
          border: none;
          background: transparent;
          cursor: pointer;
          text-align: left;
          transition: background 0.15s ease;
        }

        .menu-item:hover {
          background: rgba(0, 0, 0, 0.04);
        }

        .item-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          border-radius: 10px;
          margin-right: 12px;
          flex-shrink: 0;
        }

        .item-icon.pro {
          background: rgba(255, 92, 0, 0.1);
          color: #FF5C00;
        }

        .item-icon.flash {
          background: rgba(37, 99, 235, 0.1);
          color: #2563EB;
        }

        .item-content {
          flex: 1;
        }

        .item-title {
          font-size: 14px;
          font-weight: 600;
          color: var(--text-primary);
          margin-bottom: 2px;
        }

        .item-desc {
          font-size: 12px;
          color: var(--text-tertiary);
          line-height: 1.4;
        }

        .check-icon {
          color: var(--text-primary);
          margin-left: 12px;
        }
      `}</style>
    </div>
  );
}
