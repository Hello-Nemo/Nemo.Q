'use client';

import dynamic from 'next/dynamic';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { 
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  GripVertical,
  Clock,
  Layout,
  Monitor,
  Maximize2,
  Download,
  AlertCircle,
  Sparkles,
  Zap,
  ShieldCheck
} from 'lucide-react';

import type { DataAgentUIMessage, TimestampedDataAgentUIMessage } from '@/lib/types';
import WorkbenchLayout from '@/components/WorkbenchLayout';
import InputArea from '@/components/InputArea';
import ReasoningBlock from '@/components/ReasoningBlock';

const DataTable = dynamic(() => import('@/components/DataTable'), { ssr: false });
const SqlAudit = dynamic(() => import('@/components/SqlAudit'), { ssr: false });
const ClarificationFlow = dynamic(() => import('@/components/ClarificationFlow'), { ssr: false });
const InsightCard = dynamic(() => import('@/components/InsightCard'), { ssr: false });
const InsightCanvas = dynamic(() => import('@/components/InsightCanvas'), { ssr: false });
const ThinkingIndicator = dynamic(() => import('@/components/ThinkingIndicator'), { ssr: false });
import Logo from '@/components/Logo';
import {
  getPreviewHydrationKey,
  getPreviewToolPartInput,
  hydratePreviewToolPart,
  needsPreviewHydration,
} from '@/lib/query-plan-ui';

const SUGGESTED_QUESTIONS = [
  "分析各国家的销售额和客单价",
  "分析各月份的销售额与订单趋势",
  "分析核心忠诚客户的表现",
  "找出最近退货率最高的产品类别",
];

import { useHistory } from '@/components/HistoryContext';
import { luminaStorage } from '@/lib/db';

const createClientMessageId = (prefix: string) => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const getPartArgs = (part: any) => part?.args || part?.input || part?.invocation?.args || {};
const getPartOutput = (part: any) => part?.output || part?.result;

export default function ChatPage() {
  const { currentSessionId, updateSession, createSession, sessions } = useHistory();
  const [pinnedCards, setPinnedCards] = useState<any[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(true);
  
  const [isCanvasOpen, setIsCanvasOpen] = useState(false);
  const [canvasWidth, setCanvasWidth] = useState(480);
  const [pendingPlanActions, setPendingPlanActions] = useState<Record<string, 'confirming' | 'canceling'>>({});
  const isResizing = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);
  const isProgrammaticScroll = useRef(false);
  const previewHydrationInFlight = useRef(new Set<string>());

  // Load initial messages from session if exists
  const [initialMessages, setInitialMessages] = useState<TimestampedDataAgentUIMessage[]>([]);
  
  useEffect(() => {
    if (currentSessionId) {
      luminaStorage.getSession(currentSessionId).then(session => {
        if (session) {
          setInitialMessages(session.messages as TimestampedDataAgentUIMessage[]);
        } else {
          setInitialMessages([]);
        }
      });
    } else {
      // If no session ID, create one (this handles first load)
      const newId = createSession();
    }
  }, [currentSessionId, createSession]);

  const transport = useMemo(() => new DefaultChatTransport({ api: '/api/chat' }), []);

  const { messages, sendMessage, status, stop, error, setMessages } = useChat<TimestampedDataAgentUIMessage>({
    id: currentSessionId || 'new-session',
    messages: initialMessages,
    transport,
    experimental_throttle: 50,
    onFinish: (message) => {
      // Final save when a message is fully streamed
      if (currentSessionId) {
        // Force an update to ensure the final state is captured
      }
    },
    onError: (err) => {
      console.error('Chat error:', err);
    }
  });

  // Effect to handle multi-session switching and initial load
  const lastLoadedSessionId = useRef<string | null>(null);
  useEffect(() => {
    if (currentSessionId !== lastLoadedSessionId.current && status === 'ready') {
      setMessages(initialMessages);
      lastLoadedSessionId.current = currentSessionId;
    }
  }, [initialMessages, setMessages, currentSessionId, status]);

  // Effect to persist messages and generate title
  useEffect(() => {
    if (!currentSessionId || messages.length === 0) return;

    const isFirstMessage = messages.length === 1 && messages[0].role === 'user';
    
    const saveSession = async () => {
      let title: string | undefined;

      // If it's the first message, extract title
      if (messages.length > 0) {
        const firstUserMsg = messages.find(m => m.role === 'user');
        if (firstUserMsg) {
          const text = (firstUserMsg.parts.find(p => p.type === 'text') as any)?.text || '';
          if (text) {
            title = text.length > 30 ? text.substring(0, 30).trim() + '...' : text.trim();
          }
        }
      }

      await updateSession(currentSessionId, {
        messages: messages.map(m => ({
          ...m,
          createdAt: m.createdAt || new Date()
        })),
        ...(title ? { title } : {})
      });
    };

    // If it's the very first message, save immediately to sync sidebar
    if (isFirstMessage) {
      saveSession();
      return;
    }

    // Otherwise, debounce saves during streaming
    const saveTimeout = setTimeout(saveSession, 1500);
    return () => clearTimeout(saveTimeout);
  }, [messages, currentSessionId, updateSession]);

  const isLoading = status === 'streaming' || status === 'submitted';

  // Expert Fix: Safety wrapper to prevent stream collisions
  const safeSendMessage = useCallback((params: { text: string }) => {
    if (isLoading) {
      stop();
      // Wait for a tick to ensure the internal state settles after stopping
      setTimeout(() => {
        sendMessage(params);
      }, 10);
      return;
    }
    sendMessage(params);
  }, [isLoading, stop, sendMessage]);

  const appendSyntheticMessages = useCallback((nextMessages: TimestampedDataAgentUIMessage[]) => {
    setMessages(current => [...current, ...nextMessages] as TimestampedDataAgentUIMessage[]);
  }, [setMessages]);

  const planActionStates = useMemo(() => {
    const states: Record<string, 'confirmed' | 'canceled'> = {};

    messages.forEach(message => {
      message.parts.forEach((part: any) => {
        const output = getPartOutput(part);
        const args = getPartArgs(part);
        
        // 关键修复：优先从 audit 提取，支持从 args 兜底（用于 streaming 状态或 synthetic 消息）
        const planId = output?.audit?.planId || output?.planId || args?.planId;

        // 严格校验 planId，防止 undefined 污染 states 对象
        if (!planId || typeof planId !== 'string' || planId === 'undefined') return;

        if (part.type === 'tool-confirmQueryPlan' && output?.audit?.executed) {
          states[planId] = 'confirmed';
        }
        if (part.type === 'tool-cancelQueryPlan') {
          states[planId] = 'canceled';
        }
      });
    });

    return states;
  }, [messages]);

  useEffect(() => {
    if (status !== 'ready') return;

    const missingPreviews: Array<{ key: string; input: any }> = [];

    messages.forEach(message => {
      message.parts.forEach((part: any) => {
        if (!needsPreviewHydration(part)) return;

        const key = getPreviewHydrationKey(part);
        const input = getPreviewToolPartInput(part);
        if (!key || !input?.plan || previewHydrationInFlight.current.has(key)) return;

        previewHydrationInFlight.current.add(key);
        missingPreviews.push({ key, input });
      });
    });

    missingPreviews.forEach(async ({ key, input }) => {
      let result: any;

      try {
        const response = await fetch('/api/query-plans/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            plan: input.plan,
            explanation: input.explanation || '预览查询计划',
          }),
        });

        result = await response.json();
      } catch (err: any) {
        result = {
          error: err.message || '无法生成预览 SQL',
          code: 'PREVIEW_QUERY_PLAN_CLIENT_ERROR',
          executedSql: false,
        };
      } finally {
        previewHydrationInFlight.current.delete(key);
      }

      setMessages(current => current.map(message => ({
        ...message,
        parts: message.parts.map((part: any) => (
          getPreviewHydrationKey(part) === key
            ? hydratePreviewToolPart(part, result)
            : part
        )),
      })) as TimestampedDataAgentUIMessage[]);
    });
  }, [messages, setMessages, status]);

  const handleConfirmPlan = useCallback(async (previewData: any) => {
    const planId = previewData?.planId;
    if (!planId || pendingPlanActions[planId]) return;

    const input = {
      planId,
      plan: previewData?.plan,
      explanation: previewData?.explanation,
      previewPlanHash: previewData?.planHash || previewData?.audit?.preview?.planHash,
      previewSqlHash: previewData?.previewSqlHash || previewData?.audit?.preview?.sqlHash,
    };

    setPendingPlanActions(prev => ({ ...prev, [planId]: 'confirming' }));
    appendSyntheticMessages([
      {
        id: createClientMessageId('confirm-user'),
        role: 'user',
        createdAt: new Date(),
        metadata: { action: 'confirmQueryPlan', planId },
        parts: [{ type: 'text', text: `确认执行计划 ${planId}` }],
      } as TimestampedDataAgentUIMessage,
    ]);

    try {
      const response = await fetch('/api/query-plans/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const result = await response.json();

      appendSyntheticMessages([
        {
          id: createClientMessageId('confirm-assistant'),
          role: 'assistant',
          createdAt: new Date(),
          metadata: { action: 'confirmQueryPlan', planId },
          parts: [{
            type: 'tool-confirmQueryPlan',
            toolCallId: createClientMessageId('tool-confirm'),
            state: 'output-available',
            input,
            output: result,
          } as any],
        } as TimestampedDataAgentUIMessage,
      ]);
    } catch (err: any) {
      appendSyntheticMessages([
        {
          id: createClientMessageId('confirm-error'),
          role: 'assistant',
          createdAt: new Date(),
          metadata: { action: 'confirmQueryPlan', planId },
          parts: [{
            type: 'tool-confirmQueryPlan',
            toolCallId: createClientMessageId('tool-confirm-error'),
            state: 'output-available',
            input,
            output: {
              error: err.message || '确认执行失败',
              code: 'CONFIRM_QUERY_PLAN_CLIENT_ERROR',
              audit: { planId },
            },
          } as any],
        } as TimestampedDataAgentUIMessage,
      ]);
    } finally {
      setPendingPlanActions(prev => {
        const next = { ...prev };
        delete next[planId];
        return next;
      });
    }
  }, [appendSyntheticMessages, pendingPlanActions]);

  const handleCancelPlan = useCallback(async (previewData: any, feedback: string) => {
    const planId = previewData?.planId;
    if (!planId || pendingPlanActions[planId]) return;

    const input = {
      planId,
      feedback,
      plan: previewData?.plan,
      previewPlanHash: previewData?.planHash || previewData?.audit?.preview?.planHash,
    };

    setPendingPlanActions(prev => ({ ...prev, [planId]: 'canceling' }));
    appendSyntheticMessages([
      {
        id: createClientMessageId('cancel-user'),
        role: 'user',
        createdAt: new Date(),
        metadata: { action: 'cancelQueryPlan', planId },
        parts: [{ type: 'text', text: `取消计划 ${planId}：${feedback}` }],
      } as TimestampedDataAgentUIMessage,
    ]);

    try {
      const response = await fetch('/api/query-plans/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const result = await response.json();

      appendSyntheticMessages([
        {
          id: createClientMessageId('cancel-assistant'),
          role: 'assistant',
          createdAt: new Date(),
          metadata: { action: 'cancelQueryPlan', planId },
          parts: [{
            type: 'tool-cancelQueryPlan',
            toolCallId: createClientMessageId('tool-cancel'),
            state: 'output-available',
            input,
            output: result,
          } as any],
        } as TimestampedDataAgentUIMessage,
      ]);
    } finally {
      setPendingPlanActions(prev => {
        const next = { ...prev };
        delete next[planId];
        return next;
      });
    }
  }, [appendSyntheticMessages, pendingPlanActions]);


  const handleScroll = useCallback(() => {
    // If we just programmatically scrolled, ignore this event to avoid state loops
    if (isProgrammaticScroll.current) {
      isProgrammaticScroll.current = false;
      return;
    }

    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    
    // Check if we are close enough to the bottom to enable auto-scroll
    // Using a smaller threshold (50px) for better accuracy
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    
    setIsAutoScrollEnabled(prev => prev !== isAtBottom ? isAtBottom : prev);
  }, []);

  // Effect for auto-scrolling on ANY message update (including streaming text)
  useEffect(() => {
    if (!isAutoScrollEnabled || !scrollRef.current) return;
    
    const container = scrollRef.current;
    
    // During streaming, we force auto scroll to keep pace
    if (status === 'streaming' || status === 'submitted') {
      isProgrammaticScroll.current = true;
      container.scrollTop = container.scrollHeight;
    } else {
      // Smooth scroll for final updates
      isProgrammaticScroll.current = true;
      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages, isAutoScrollEnabled, status]);

  const startResize = useCallback((e: React.MouseEvent) => {
    isResizing.current = true;
    startX.current = e.clientX;
    startWidth.current = canvasWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMove = (ev: MouseEvent) => {
      if (!isResizing.current) return;
      const delta = startX.current - ev.clientX;
      const newWidth = Math.max(360, Math.min(900, startWidth.current + delta));
      setCanvasWidth(newWidth);
    };

    const onUp = () => {
      isResizing.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [canvasWidth]);

  const handlePin = (cardData: any) => {
    if (pinnedCards.find(c => c.id === cardData.id)) {
      setIsCanvasOpen(true); // Even if already pinned, unfold to show it
      return;
    }
    setPinnedCards([...pinnedCards, { ...cardData, isPinned: true }]);
    setIsCanvasOpen(true);
  };

  const handleAction = (rowData: any) => {
    const summary = Object.entries(rowData).map(([k, v]) => `${k}: ${v}`).join(', ');
    safeSendMessage({ text: `针对这条记录深度分析其对业务的影响：${summary}` });
  };

  const renderWelcome = () => (
    <div className="welcome-root">
      <div className="welcome-inner animate-fade-in">
        <div className="header-box">
          <div className="hero-brand-unit">
            <Logo size={100} showText={false} className="hero-logo-main" />
            <div className="hero-title-group">
              <span className="hero-name">NEMO</span>
              <span className="hero-dot-q">.Q</span>
            </div>
          </div>
          
          <div className="hero-scan-area">
            <div className="scanline" />
          </div>
          

        </div>

        <div className="hero-section">
          <h2 className="hero-title">
            <span className="gradient-text">探索数据</span>的无限可能
          </h2>
          <p className="hero-subtitle">Precision In, Truth Out. 让 AI 助您洞察业务核心。</p>
        </div>

        
        <div className="templates-section">
          <div className="template-grid">
            {SUGGESTED_QUESTIONS.map((q) => (
              <button key={q} onClick={() => safeSendMessage({ text: q })} className="template-pill soft-surface">
                <span className="q-text">{q}</span>
                <div className="q-hover-aura" />
              </button>
            ))}
          </div>
        </div>
      </div>

      <style jsx>{`
        .welcome-root { display: flex; align-items: center; justify-content: center; min-height: 100%; padding: 120px 40px; position: relative; }
        .welcome-inner { width: 100%; max-width: 800px; display: flex; flex-direction: column; gap: 64px; align-items: center; text-align: center; }
        
        .header-box { display: flex; flex-direction: column; align-items: center; gap: 24px; }
        
        /* --- Hero Horizontal Brand Layout --- */
        .hero-brand-unit {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 24px;
          padding: 20px 40px;
          margin-bottom: 10px;
          white-space: nowrap;
        }

        .hero-logo-main {
          filter: drop-shadow(0 0 30px rgba(255, 92, 0, 0.2));
          animation: logo-float 6s ease-in-out infinite;
        }

        @keyframes logo-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }

        .hero-title-group {
          display: flex;
          align-items: baseline;
          flex-shrink: 0;
        }

        .hero-name {
          font-size: 110px;
          font-weight: 900;
          letter-spacing: -0.06em;
          color: var(--text-primary);
          line-height: 1;
          margin: 0;
        }

        .hero-dot-q {
          font-size: 80px;
          font-weight: 900;
          color: #FF5C00;
          line-height: 1;
          margin-left: 4px;
        }

        .hero-scan-area {
          position: absolute;
          top: 0; left: 0; width: 100%; height: 200px;
          pointer-events: none;
          z-index: 5;
        }

        .scanline {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 1.5px;
          background: linear-gradient(to right, transparent, #FF5C00, transparent);
          box-shadow: 0 0 20px rgba(255, 92, 0, 0.4);
          animation: scan 5s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }

        @keyframes scan {
          0% { top: 10%; opacity: 0; }
          15% { opacity: 0.8; }
          85% { opacity: 0.8; }
          100% { top: 90%; opacity: 0; }
        }



        .hero-section { display: flex; flex-direction: column; gap: 16px; }
        .hero-title { font-size: 56px; font-weight: 800; letter-spacing: -0.05em; color: var(--text-primary); line-height: 1.1; }
        .gradient-text { background: var(--accent-flow); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .hero-subtitle { font-size: 18px; color: var(--text-secondary); max-width: 460px; margin: 0 auto; }


        .templates-section { width: 100%; }
        .template-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
        .template-pill { 
          padding: 24px; 
          text-align: left; 
          position: relative; 
          overflow: hidden; 
          transition: all 0.4s var(--spring); 
        }
        .template-pill:hover { transform: translateY(-4px) scale(1.02); box-shadow: var(--shadow-deep); border-color: var(--accent-primary); }
        .q-text { font-size: 15px; font-weight: 600; color: var(--text-primary); z-index: 2; position: relative; }
        .q-hover-aura { 
          position: absolute; inset: 0; 
          background: radial-gradient(circle at var(--x, 50%) var(--y, 50%), rgba(99, 102, 241, 0.05), transparent 70%);
          opacity: 0; transition: opacity 0.3s;
        }
        .template-pill:hover .q-hover-aura { opacity: 1; }
      `}</style>
    </div>
  );

  const renderPart = (part: DataAgentUIMessage['parts'][number], i: number, parts: DataAgentUIMessage['parts']) => {
    switch (part.type) {
      case 'text':
        if (!part.text?.trim()) return null;
        return (
          <div key={`part-text-${i}`} className="part-unit md-part prose-lumina animate-fade-in">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{part.text}</ReactMarkdown>
          </div>
        );

      case 'reasoning': {
        const reasoningPart = part as any;
        const isLastPart = i === (parts.length - 1);
        const isActive = isLoading && isLastPart;
        
        return (
          <div key={`part-reasoning-${i}`} className="part-unit reasoning-container-wrapper animate-fade-in">
            <ReasoningBlock 
              text={reasoningPart.reasoning || reasoningPart.text || ''} 
              isActive={isActive} 
            />
          </div>
        );
      }

      case 'tool-askClarification': {
        const toolPart = part as any;
        const args = getPartArgs(toolPart);
        
        return (
          <div key={`part-clarification-${i}`} className="part-unit flow-part animate-fade-in">
            <ClarificationFlow
              question={args.question || ''}
              options={args.options || []}
              context={args.context || ''}
              defaultAssumption={args.defaultAssumption || '无'}
              onSelect={(val) => safeSendMessage({ text: `选择：${val}` })}
              onSkip={() => safeSendMessage({ text: '跳过确认' })}
            />
          </div>
        );
      }

      case 'tool-previewQueryPlan': {
        const toolPart = part as any;
        if (!toolPart) return null;
        const args = getPartArgs(toolPart);
        const output = getPartOutput(toolPart);
        const state = toolPart?.state || 'unknown';
        
        // 预览结果可能在 output 中（如果已执行）或在 args 中（如果是待确认状态）
        const displayData = (output || args) as any;
        const planId = displayData?.planId || displayData?.audit?.planId;
        const pendingAction = planId ? pendingPlanActions[planId] : undefined;
        // 增加对 planId 的存在性校验
        const completedAction = (planId && typeof planId === 'string' && planId !== 'undefined') 
          ? planActionStates[planId] 
          : undefined;
        const actionState = completedAction || pendingAction;
        
        return (
          <div key={`part-preview-${i}`} className="part-unit flow-part animate-fade-in">
            <div className="preview-container">
              <div className="preview-label">
                <ShieldCheck size={14} />
                <span>意图确认 / INTENT_CONFIRMATION</span>
              </div>
              
              <SqlAudit 
                sql={displayData?.sql} 
                explanation={displayData?.explanation}
                debugRaw={{ output: { audit: displayData?.audit || { lineage: displayData?.lineage, plan: displayData?.plan, planId } } }}
              />

              {(!output || output?.requires_action) && (
                actionState === 'confirmed' ? (
                  <div className="action-status confirmed">
                    <ShieldCheck size={14} />
                    <span>已确认并执行</span>
                  </div>
                ) : actionState === 'canceled' ? (
                  <div className="action-status canceled">
                    <AlertCircle size={14} />
                    <span>已取消，等待新的调整说明</span>
                  </div>
                ) : (
                  <div className="preview-actions">
                    <button
                      className="confirm-btn soft-surface"
                      disabled={!planId || pendingAction === 'confirming' || pendingAction === 'canceling'}
                      onClick={() => handleConfirmPlan(displayData)}
                    >
                      <Zap size={14} />
                      <span>{pendingAction === 'confirming' ? '执行中...' : '确认并执行'}</span>
                    </button>
                    <button
                      className="cancel-btn soft-surface"
                      disabled={!planId || pendingAction === 'confirming' || pendingAction === 'canceling'}
                      onClick={() => handleCancelPlan(displayData, '我不确定，请重新调整')}
                    >
                      <AlertCircle size={14} />
                      <span>{pendingAction === 'canceling' ? '取消中...' : '重新调整'}</span>
                    </button>
                  </div>
                )
              )}
            </div>
            <style jsx>{`
              .preview-container {
                background: rgba(255, 255, 255, 0.6);
                border: 1px solid var(--accent-primary);
                border-radius: 20px;
                padding: 24px;
                display: flex;
                flex-direction: column;
                gap: 16px;
                box-shadow: 0 10px 30px rgba(99, 102, 241, 0.08);
              }
              .preview-label {
                display: flex;
                align-items: center;
                gap: 8px;
                font-family: var(--font-mono);
                font-size: 10px;
                font-weight: 800;
                color: var(--accent-primary);
              }
              .preview-actions {
                display: flex;
                gap: 12px;
                margin-top: 8px;
              }
              .confirm-btn {
                flex: 1;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 10px;
                padding: 14px;
                background: #0F172A;
                color: #FFF;
                border: none;
                border-radius: 12px;
                font-size: 14px;
                font-weight: 800;
                cursor: pointer;
                transition: all 0.3s;
              }
              .confirm-btn:hover {
                background: #1E293B;
                transform: scale(1.02);
              }
              .confirm-btn:disabled,
              .cancel-btn:disabled {
                opacity: 0.55;
                cursor: not-allowed;
                transform: none;
              }
              .cancel-btn {
                padding: 14px 24px;
                background: #FFFFFF;
                color: #64748B;
                border: 1px solid #E2E8F0;
                border-radius: 12px;
                font-size: 14px;
                font-weight: 700;
                cursor: pointer;
                transition: all 0.3s;
              }
              .cancel-btn:hover {
                background: #F8FAFC;
                color: #1E293B;
              }
              .action-status {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                padding: 12px 14px;
                border-radius: 12px;
                font-size: 13px;
                font-weight: 800;
              }
              .action-status.confirmed {
                color: #047857;
                background: #ECFDF5;
                border: 1px solid #A7F3D0;
              }
              .action-status.canceled {
                color: #92400E;
                background: #FFFBEB;
                border: 1px solid #FDE68A;
              }
            `}</style>
          </div>
        );
      }

      case 'tool-semanticQuery':
      case 'tool-analysisQuery':
      case 'tool-confirmQueryPlan':
      case 'tool-executeQuery': {
        const toolPart = part as any;
        if (!toolPart) return null;
        const args = getPartArgs(toolPart);
        const output = getPartOutput(toolPart);
        
        // 提取审计数据：优先从 output 中获取（如果已执行），否则从 args 中获取（初始调用状态）
        const auditData = output?.audit || args;
        const finalExplanation = auditData?.explanation || args?.explanation;
        const finalAssumptions = auditData?.assumptions || args?.assumptions;

        const state = toolPart?.state || 'unknown';

        return (
          <div key={`part-query-${i}`} className="part-unit flow-part animate-fade-in">
            <div className="component-container">
              <SqlAudit 
                sql={auditData?.sql || args?.sql} 
                explanation={finalExplanation} 
                assumptions={finalAssumptions} 
                isStreaming={state === 'call' && !output} 
                debugRaw={toolPart}
              />
              
              <div className={`result-drawer ${output || state === 'output-error' ? 'is-ready' : 'is-loading'}`}>
                {output?.error || toolPart?.errorText ? (
                  <div className="error-block soft-surface">
                    <AlertCircle size={16} />
                    <p>{output?.error || toolPart?.errorText}</p>
                  </div>
                ) : output?.rows ? (
                  <DataTable rows={output.rows} rowCount={output.rowCount} />
                ) : (
                  <div className="loading-placeholder">
                    <div className="shimmer-table" />
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      }

      case 'tool-cancelQueryPlan': {
        const toolPart = part as any;
        const args = getPartArgs(toolPart);
        const output = getPartOutput(toolPart);
        const planId = output?.planId || args?.planId;

        return (
          <div key={`part-cancel-${i}`} className="part-unit flow-part animate-fade-in">
            <div className="cancelled-plan soft-surface">
              <AlertCircle size={16} />
              <div className="cancelled-copy">
                <span className="cancelled-title">计划已取消</span>
                <span className="cancelled-meta">{planId ? `PLAN_ID ${planId}` : '等待重新调整'}</span>
              </div>
            </div>
            <style jsx>{`
              .cancelled-plan {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 14px 16px;
                color: #92400E;
                background: #FFFBEB;
                border: 1px solid #FDE68A;
                border-radius: 12px;
              }
              .cancelled-copy {
                display: flex;
                flex-direction: column;
                gap: 2px;
              }
              .cancelled-title {
                font-size: 13px;
                font-weight: 800;
              }
              .cancelled-meta {
                font-family: var(--font-mono);
                font-size: 9px;
                font-weight: 700;
                color: #B45309;
              }
            `}</style>
          </div>
        );
      }

      case 'tool-getSchema':
      case 'tool-getTableSamples':
      case 'tool-searchTables':
      case 'tool-listSemanticAtoms': {
        const toolPart = part as any;
        const state = toolPart?.state || 'unknown';
        if (state === 'result') return null; // 辅助工具的结果通常不需要直接展示在主流中
        
        return (
          <div key={`part-util-${i}`} className="part-unit util-part animate-fade-in">
            <div className="util-indicator">
              <Clock size={12} className="spin-slow" />
              <span>正在分析数据库结构...</span>
            </div>
            <style jsx>{`
              .util-indicator {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 8px 16px;
                background: rgba(0,0,0,0.03);
                border-radius: 8px;
                font-size: 11px;
                color: var(--text-tertiary);
                margin: 4px 0;
              }
              .spin-slow { animation: spin 3s linear infinite; }
              @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
          </div>
        );
      }

      case 'tool-render_chart': {
        const toolPart = part as any;
        if (!toolPart) return null;

        const output = getPartOutput(toolPart);
        const state = toolPart?.state || 'unknown';

        if (!output) return <div key={`part-chart-sk-${i}`} className="skeleton-card soft-surface" />;

        return (
          <div key={`part-chart-${i}`} className="part-unit flow-part animate-fade-in">
            <div className="component-container">
              <InsightCard 
                id={toolPart?.toolCallId || `chart-${i}`}
                type="chart"
                title={output?.title || '分析图表'}
                description={output?.description}
                data={output?.data || []}
                chartType={output?.type === 'bar' ? 'bar' : 'area'}
                isCertified={output?.audit?.isCertified}
                audit={output?.audit}
              />
              <div className="action-overlay">
                <button className="action-pill soft-surface" onClick={() => handlePin({
                  id: toolPart?.toolCallId,
                  type: 'chart',
                  title: output?.title,
                  data: output?.data,
                  chartType: output?.type === 'bar' ? 'bar' : 'area',
                })}>
                  <Maximize2 size={12} />
                  <span>洞察画布</span>
                </button>
              </div>
            </div>
          </div>
        );
      }

      default: return null;
    }
  };

  return (
    <WorkbenchLayout>
      <div className="ambient-bg">
        <div className="aura-blob aura-1" />
        <div className="aura-blob aura-2" />
        <div className="aura-blob aura-3" />
      </div>

      <div className="chat-col">
        <div className="stream-zone" ref={scrollRef} onScroll={handleScroll}>
          {messages.length === 0 ? renderWelcome() : (
            <div className="message-list">
              {messages.map((message, idx) => (
                <div key={message.id ? `msg-${message.id}-${idx}` : `msg-idx-${idx}`} className={`message-turn ${message.role}`}>
                  
                  {message.role === 'user' ? (
                    <div className="user-turn-content">
                      <div className="user-turn-inner">
                        <div className="user-meta">
                          <span className="timestamp">
                            {new Date(message.createdAt || Date.now()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                          </span>
                          <div className="meta-sep" />
                          <span className="user-label">YOU</span>
                        </div>
                        <div className="user-bubble">
                          {(message.parts.find(p => p.type === 'text') as any)?.text || ''}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="assistant-turn-content">
                      <div className="turn-meta">
                        <div className="agent-orb" />
                        <span className="agent-label">NEMO.Q</span>
                        <div className="meta-sep" />
                        <span className="timestamp">
                          {new Date(message.createdAt || Date.now()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </span>
                      </div>
                      <div className="turn-body">
                        {(() => {
                          const parts = message.parts as DataAgentUIMessage['parts'];
                          const stopIdx = parts.findIndex(p => p.type === 'tool-askClarification' || p.type === 'tool-previewQueryPlan');
                          const renderedParts = stopIdx !== -1 ? parts.slice(0, stopIdx + 1) : parts;
                          
                          return renderedParts.map((part, i, all) =>
                            renderPart(part, i, all)
                          );
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Thinking Indicator integrated into chat flow */}
              {(() => {
                if (!isLoading) return null;
                const lastMessage = messages[messages.length - 1];
                if (!lastMessage || lastMessage.role !== 'assistant' || lastMessage.parts.length === 0) {
                  return (
                    <div key="thinking-indicator-turn" className="message-turn assistant loading-turn">
                      <div className="assistant-turn-content">
                        <div className="turn-meta">
                          <div className="agent-orb pulsing" />
                          <span className="agent-label">NEMO.Q</span>
                          <div className="meta-sep" />
                          <span className="timestamp">系统就绪</span>
                        </div>
                        <div className="turn-body">
                          <ThinkingIndicator />
                        </div>
                      </div>
                    </div>
                  );
                }
                
                // If assistant turn has started, check if it already contains active indicators
                const hasReasoning = lastMessage.parts.some(p => p.type === 'reasoning');
                const hasClarification = lastMessage.parts.some(p => p.type === 'tool-askClarification');
                
                if (hasReasoning || hasClarification) return null;
                
                // Fallback indicator for intermediate states (e.g. between tool calls)
                return (
                  <div key="thinking-indicator-turn" className="message-turn assistant loading-turn">
                    <div className="assistant-turn-content">
                      <div className="turn-body">
                        <ThinkingIndicator />
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {error && (
            <div className="error-boundary animate-fade-in">
              <div className="error-inner soft-surface">
                <AlertCircle size={20} className="error-icon" />
                <div className="error-content">
                  <span className="error-title">连接中断或执行异常</span>
                  <p className="error-desc">{error.message || '由于网络波动或模型响应超时，输出已停止。'}</p>
                </div>
                <button className="retry-btn soft-surface" onClick={() => safeSendMessage({ text: '重试上一次操作' })}>
                  重试
                </button>
              </div>
            </div>
          )}
          
          {!isAutoScrollEnabled && messages.length > 0 && (
            <button onClick={() => setIsAutoScrollEnabled(true)} className="scroll-pills soft-surface">
              <ChevronDown size={14} />
              <span>最新洞察</span>
            </button>
          )}
        </div>

        <div className="input-zone">
          <InputArea
            isLoading={isLoading || messages[messages.length - 1]?.parts.some(p => p.type === 'tool-askClarification')}
            onSend={(text) => safeSendMessage({ text })}
            onStop={() => stop()}
          />
        </div>
      </div>

      {pinnedCards.length > 0 && (
        <div className={`canvas-col ${isCanvasOpen ? 'open' : 'collapsed'}`}
          style={isCanvasOpen ? { width: canvasWidth } : {}}
        >
          {isCanvasOpen && (
            <div className="resize-handle" onMouseDown={startResize}>
              <div className="handle-line" />
            </div>
          )}
          
          {!isCanvasOpen && (
            <button className="canvas-tab soft-surface" onClick={() => setIsCanvasOpen(true)}>
              <ChevronLeft size={16} />
              <div className="tab-badge">{pinnedCards.length}</div>
            </button>
          )}

          {isCanvasOpen && (
            <div className="canvas-frame">
              <div className="canvas-header">
                <div className="header-info">
                  <span className="title">洞察画布 (INSIGHT_CANVAS)</span>
                  <span className="count">{pinnedCards.length} ITEMS</span>
                </div>
                <button className="close-btn" onClick={() => setIsCanvasOpen(false)}>
                  <ChevronRight size={18} />
                </button>
              </div>
              <div className="canvas-body">
                <InsightCanvas cards={pinnedCards} />
              </div>
            </div>
          )}
        </div>
      )}

      <style jsx global>{`
        .md-part { font-size: 16px; line-height: 1.8; color: var(--text-primary); }
        .md-part p { margin-bottom: 16px; }
        .md-part strong { font-weight: 700; color: var(--accent-primary); }
        .md-part code { font-family: var(--font-mono); font-size: 13px; background: rgba(99, 102, 241, 0.05); padding: 3px 8px; border-radius: 6px; color: var(--accent-primary); }
        .md-part ul, .md-part ol { margin-bottom: 16px; padding-left: 20px; }
        .md-part li { margin-bottom: 8px; }
      `}</style>

      <style jsx>{`
        .chat-col { flex: 1; display: flex; flex-direction: column; height: 100%; min-width: 0; background: transparent; position: relative; }
        .stream-zone { flex: 1; overflow-y: auto; scroll-behavior: smooth; }
        
        .message-list { max-width: 1000px; margin: 0 auto; padding: 80px 40px 300px; display: flex; flex-direction: column; gap: 80px; }
        
        .message-turn { position: relative; width: 100%; }
        
        .user-turn-content { display: flex; justify-content: flex-end; }
        .user-turn-inner { display: flex; flex-direction: column; align-items: flex-end; gap: 8px; max-width: 80%; }
        .user-meta { display: flex; align-items: center; gap: 12px; font-family: var(--font-mono); font-size: 10px; font-weight: 800; color: var(--text-tertiary); letter-spacing: 0.1em; }
        .user-bubble { 
          background: var(--text-primary); 
          color: white; 
          padding: 16px 24px; 
          border-radius: 24px 24px 4px 24px; 
          font-size: 16px; 
          font-weight: 600; 
          box-shadow: var(--shadow-deep); 
        }

        .assistant-turn-content { display: flex; flex-direction: column; gap: 24px; }
        .turn-meta { display: flex; align-items: center; gap: 12px; font-family: var(--font-mono); font-size: 10px; font-weight: 800; color: var(--text-tertiary); letter-spacing: 0.1em; }
        .agent-orb { width: 8px; height: 8px; background: var(--accent-primary); border-radius: 50%; box-shadow: 0 0 10px var(--accent-primary); }
        .agent-orb.pulsing { animation: orb-pulse 2s infinite; }
        @keyframes orb-pulse { 0% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.5); opacity: 0.5; } 100% { transform: scale(1); opacity: 1; } }
        .meta-sep { width: 4px; height: 4px; background: var(--surface-border); border-radius: 50%; }
        
        .turn-body { display: flex; flex-direction: column; }

        .reasoning-container-wrapper { margin: 8px 0; }

        .input-zone {
          position: sticky;
          bottom: 32px;
          margin: 0 auto;
          width: 100%;
          max-width: 800px;
          z-index: 50;
        }
        
        .component-container { position: relative; display: flex; flex-direction: column; gap: 16px; }
        .action-overlay { position: absolute; top: -12px; right: 12px; opacity: 0; transition: all 0.3s var(--spring); transform: translateY(4px); z-index: 20; }
        .component-container:hover .action-overlay { opacity: 1; transform: translateY(0); }
        .action-pill { display: flex; align-items: center; gap: 8px; padding: 10px 20px; font-size: 12px; font-weight: 700; color: var(--accent-primary); border-radius: 99px; }

        .skeleton-placeholder { height: 160px; border-radius: 24px; overflow: hidden; position: relative; }
        .sk-pulse { height: 100%; width: 100%; background: linear-gradient(90deg, transparent, rgba(99, 102, 241, 0.05), transparent); animation: sk-flow 2s infinite; }
        @keyframes sk-flow { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }

        .scroll-pills { position: absolute; bottom: 120px; left: 50%; transform: translateX(-50%); display: flex; align-items: center; gap: 10px; padding: 14px 28px; border-radius: 99px; font-size: 12px; font-weight: 700; color: var(--accent-primary); z-index: 100; }

        .error-boundary { max-width: 800px; margin: 40px auto; padding: 0 40px; position: relative; z-index: 100; }
        .error-inner { padding: 24px; border-radius: 24px; border: 1px solid rgba(239, 68, 68, 0.2); background: rgba(255, 255, 255, 0.8); display: flex; align-items: center; gap: 20px; }
        .error-icon { color: #ef4444; }
        .error-content { flex: 1; }
        .error-title { display: block; font-size: 14px; font-weight: 800; color: #111827; margin-bottom: 4px; }
        .error-desc { font-size: 13px; color: #6b7280; margin: 0; }
        .retry-btn { padding: 10px 24px; font-size: 12px; font-weight: 800; color: var(--accent-primary); border-radius: 12px; }
        .retry-btn:hover { background: var(--accent-primary); color: white; border-color: var(--accent-primary); }

        .canvas-col { flex-shrink: 0; height: 100%; display: flex; background: rgba(255, 255, 255, 0.4); backdrop-filter: blur(20px); border-left: 1px solid var(--surface-border); transition: width 0.5s cubic-bezier(0.16, 1, 0.3, 1); position: relative; }
        .canvas-col.collapsed { width: 80px; background: transparent; backdrop-filter: none; border: none; }
        .canvas-tab { position: absolute; top: 50%; left: 20px; transform: translateY(-50%); width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; border-radius: 50%; color: var(--accent-primary); }
        .tab-badge { position: absolute; top: -4px; right: -4px; width: 18px; height: 18px; background: var(--accent-secondary); color: white; border-radius: 50%; font-size: 10px; font-weight: 800; display: flex; align-items: center; justify-content: center; }
        
        .canvas-frame { flex: 1; display: flex; flex-direction: column; overflow: hidden; animation: fadeIn 0.5s ease; }
        .canvas-header { padding: 32px; display: flex; align-items: center; justify-content: space-between; }
        .title { font-size: 14px; font-weight: 800; letter-spacing: 0.05em; color: var(--text-primary); }
        .count { font-family: var(--font-mono); font-size: 11px; font-weight: 800; color: var(--accent-primary); background: rgba(99, 102, 241, 0.1); padding: 4px 12px; border-radius: 99px; margin-left: 12px; }
        .canvas-body { flex: 1; overflow: hidden; padding: 0 32px 32px; }
        .close-btn { color: var(--text-tertiary); padding: 8px; border-radius: 50%; }
        .close-btn:hover { background: rgba(0,0,0,0.05); color: var(--text-primary); }


      `}</style>
    </WorkbenchLayout>
  );
}
