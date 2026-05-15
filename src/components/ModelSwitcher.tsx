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
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, zIndex: 100 }}
          >
            <div className="dropdown-menu">
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
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
