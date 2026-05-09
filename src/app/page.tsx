'use client';

import dynamic from 'next/dynamic';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo } from 'react';
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
  ShieldCheck,
  CheckCircle2,
  Loader2,
  BarChart3
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

const SUGGESTED_QUESTIONS = [
  "分析各国家的销售额和客单价",
  "分析各月份的销售额与订单趋势",
  "分析核心忠诚客户的表现",
  "找出最近退货率最高的产品类别",
];

type PreviewExecutionState = {
  status: 'loading' | 'success' | 'error';
  result?: {
    rowCount?: number;
    rows?: any[];
    message?: string;
    audit?: any;
    error?: string;
  };
  error?: string;
};

const EXECUTION_TOOL_TYPES = new Set([
  'tool-semanticQuery',
  'tool-executeQuery',
  'tool-render_chart',
  'tool-generateInsightCanvas',
]);

const COLUMN_LABELS: Record<string, string> = {
  user_country: '国家',
  country: '国家',
  sales_amount: '销售额',
  aov: '客单价',
  order_count: '订单量',
  user_count: '用户数',
  return_amount: '退货金额',
};

const isNumericLike = (value: any) => {
  if (typeof value === 'number') return Number.isFinite(value);
  return typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value));
};

const toNumber = (value: any) => typeof value === 'number' ? value : Number(value);

const formatColumnLabel = (key: string) => {
  if (COLUMN_LABELS[key]) return COLUMN_LABELS[key];
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const isExecutionPartType = (type: string) => EXECUTION_TOOL_TYPES.has(type);

const buildChartSpecs = (rows: any[]) => {
  if (!rows?.length) return [];

  const keys = Object.keys(rows[0]);
  const numericKeys = keys.filter((key) => rows.some((row) => isNumericLike(row[key])));
  const dimensionKey = keys.find((key) => !numericKeys.includes(key)) || keys[0];

  return numericKeys.slice(0, 2).map((metricKey) => ({
    metricKey,
    dimensionKey,
    title: `${formatColumnLabel(metricKey)} by ${formatColumnLabel(dimensionKey)}`,
    data: rows.map((row) => ({
      ...row,
      [metricKey]: toNumber(row[metricKey]),
    })),
  }));
};

import { useHistory } from '@/components/HistoryContext';
import {
  getCachedSessionMessages,
  getMessagesFingerprint,
  shouldPersistMessages,
  type MessagesSnapshot,
} from '@/lib/session-state';

export default function ChatPage() {
  const { currentSessionId, updateSession, createSession, sessions } = useHistory();
  const [pinnedCards, setPinnedCards] = useState<any[]>([]);
  const [executedPreviews, setExecutedPreviews] = useState<Record<string, PreviewExecutionState>>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(true);
  
  const [isCanvasOpen, setIsCanvasOpen] = useState(false);
  const [canvasWidth, setCanvasWidth] = useState(480);
  const isResizing = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);
  const isProgrammaticScroll = useRef(false);
  const sessionsRef = useRef(sessions);
  const hydratedSnapshotRef = useRef<MessagesSnapshot | null>(null);
  const [messageOwnerSessionId, setMessageOwnerSessionId] = useState<string | null>(currentSessionId);

  const transport = useMemo(() => new DefaultChatTransport({ api: '/api/chat' }), []);

  const { messages, sendMessage, status, stop, error, setMessages } = useChat<TimestampedDataAgentUIMessage>({
    id: currentSessionId || 'new-session',
    messages: [],
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

  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

  const hydrateMessages = useCallback((sessionId: string, nextMessages: TimestampedDataAgentUIMessage[]) => {
    hydratedSnapshotRef.current = {
      sessionId,
      fingerprint: getMessagesFingerprint(nextMessages),
    };
    setMessageOwnerSessionId(sessionId);
    setMessages(nextMessages);
  }, [setMessages]);

  // Keep the visible chat in sync with the selected session without saving hydrated history.
  useLayoutEffect(() => {
    if (!currentSessionId) {
      createSession();
      return;
    }

    const cachedMessages = getCachedSessionMessages<TimestampedDataAgentUIMessage>(
      sessionsRef.current,
      currentSessionId
    );

    hydrateMessages(currentSessionId, cachedMessages);
    setExecutedPreviews({});
    setIsAutoScrollEnabled(true);
  }, [currentSessionId, createSession, hydrateMessages]);

  useEffect(() => {
    if (!currentSessionId || messageOwnerSessionId === currentSessionId) return;
    setMessageOwnerSessionId(currentSessionId);
  }, [currentSessionId, messageOwnerSessionId]);

  // Effect to persist messages and generate title
  useEffect(() => {
    if (!currentSessionId) return;

    if (!shouldPersistMessages({
      currentSessionId,
      messageOwnerSessionId,
      messages,
      hydratedSnapshot: hydratedSnapshotRef.current,
    })) return;

    const sessionId = currentSessionId;
    const fingerprint = getMessagesFingerprint(messages);

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

      await updateSession(sessionId, {
        messages: messages.map(m => ({
          ...m,
          createdAt: m.createdAt || new Date()
        })),
        ...(title ? { title } : {})
      });
      hydratedSnapshotRef.current = { sessionId, fingerprint };
    };

    // If it's the very first message, save immediately to sync sidebar
    if (isFirstMessage) {
      saveSession();
      return;
    }

    // Otherwise, debounce saves during streaming
    const saveTimeout = setTimeout(saveSession, 1500);
    return () => clearTimeout(saveTimeout);
  }, [messages, currentSessionId, messageOwnerSessionId, updateSession]);

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
    const existing = pinnedCards.find(c => c.id === cardData.id);
    if (existing) {
      setPinnedCards(pinnedCards.filter(c => c.id !== cardData.id));
      return;
    }
    setPinnedCards([...pinnedCards, { ...cardData, isPinned: true }]);
    setIsCanvasOpen(true);
  };

  const handleAction = (rowData: any) => {
    const summary = Object.entries(rowData).map(([k, v]) => `${k}: ${v}`).join(', ');
    safeSendMessage({ text: `针对这条记录深度分析其对业务的影响：${summary}` });
  };

  const executePreviewPlan = useCallback(async (previewKey: string, displayData: any) => {
    const plan = displayData?.plan;

    if (!plan) {
      setExecutedPreviews(prev => ({
        ...prev,
        [previewKey]: {
          status: 'error',
          error: '这条预览缺少可执行 QueryPlan，请重新生成查询预览。'
        }
      }));
      return;
    }

    setExecutedPreviews(prev => ({
      ...prev,
      [previewKey]: { status: 'loading' }
    }));

    try {
      const response = await fetch('/api/query/execute-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan,
          explanation: displayData?.explanation || '用户确认执行预览查询计划。'
        })
      });

      const result = await response.json();

      if (!response.ok || result?.error) {
        throw new Error(result?.error || '查询执行失败');
      }

      setExecutedPreviews(prev => ({
        ...prev,
        [previewKey]: {
          status: 'success',
          result
        }
      }));
    } catch (err: any) {
      setExecutedPreviews(prev => ({
        ...prev,
        [previewKey]: {
          status: 'error',
          error: err?.message || '查询执行失败'
        }
      }));
    }
  }, []);

  const renderPreviewExecution = (previewKey: string, state?: PreviewExecutionState) => {
    if (!state) return null;

    if (state.status === 'loading') {
      return (
        <div className="preview-execution execution-loading">
          <Loader2 size={16} className="spin-slow" />
          <span>正在执行已确认的查询计划...</span>
        </div>
      );
    }

    if (state.status === 'error') {
      return (
        <div className="preview-execution execution-error">
          <AlertCircle size={16} />
          <span>{state.error || '查询执行失败'}</span>
        </div>
      );
    }

    const rows = state.result?.rows || [];
    const chartSpecs = buildChartSpecs(rows);

    return (
      <div className="preview-execution execution-ready">
        <div className="execution-head">
          <div className="execution-title">
            <CheckCircle2 size={16} />
            <span>已执行查询计划</span>
          </div>
          <span className="execution-count">{state.result?.rowCount ?? rows.length} 行结果</span>
        </div>

        {state.result?.message && (
          <p className="execution-note">{state.result.message}</p>
        )}

        {chartSpecs.length > 0 && (
          <div className="preview-chart-grid">
            {chartSpecs.map((spec) => (
              <InsightCard
                key={`${previewKey}-${spec.metricKey}`}
                id={`${previewKey}-${spec.metricKey}`}
                type="chart"
                chartType="bar"
                title={spec.title}
                data={spec.data}
                config={{ xAxis: spec.dimensionKey, yAxis: spec.metricKey }}
                compact
                isCertified={state.result?.audit?.isCertified}
              />
            ))}
          </div>
        )}

        {rows.length > 0 ? (
          <DataTable rows={rows} rowCount={state.result?.rowCount} onAction={handleAction} />
        ) : (
          <div className="empty-result">查询成功，但没有返回数据。</div>
        )}
      </div>
    );
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
            <span className="gradient-text">探索数据</span><span className="hero-title-rest">的无限可能</span>
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
        .welcome-root { display: flex; align-items: center; justify-content: center; min-height: 100%; padding: 80px 20px; position: relative; overflow-y: auto; }
        .welcome-inner { width: 100%; max-width: 840px; display: flex; flex-direction: column; gap: 48px; align-items: center; text-align: center; }
        
        .header-box { display: flex; flex-direction: column; align-items: center; gap: 16px; }
        
        /* --- Hero Horizontal Brand Layout --- */
        .hero-brand-unit {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 32px;
          padding: 24px;
          margin-bottom: 0;
          white-space: nowrap;
        }

        @media (max-width: 640px) {
          .hero-brand-unit {
            flex-direction: column;
            gap: 16px;
          }
          .hero-name { font-size: 72px !important; }
          .hero-dot-q { font-size: 56px !important; }
        }

        .hero-logo-main {
          filter: drop-shadow(0 0 40px rgba(255, 92, 0, 0.3));
          animation: logo-float 6s ease-in-out infinite;
        }

        @keyframes logo-float {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-12px) rotate(2deg); }
        }

        .hero-title-group {
          display: flex;
          align-items: baseline;
          flex-shrink: 0;
        }

        .hero-name {
          font-size: 120px;
          font-weight: 900;
          letter-spacing: -0.07em;
          color: var(--text-primary);
          line-height: 0.9;
          margin: 0;
          filter: drop-shadow(0 10px 20px rgba(0,0,0,0.05));
        }

        .hero-dot-q {
          font-size: 90px;
          font-weight: 900;
          color: #FF5C00;
          line-height: 0.9;
          margin-left: 2px;
        }

        .hero-scan-area {
          position: absolute;
          top: -20px; left: 0; width: 100%; height: calc(100% + 40px);
          pointer-events: none;
          z-index: 5;
          overflow: hidden;
        }

        .scanline {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 2px;
          background: linear-gradient(to right, transparent, #FF5C00, transparent);
          box-shadow: 0 0 25px rgba(255, 92, 0, 0.5);
          animation: scan 6s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }

        @keyframes scan {
          0% { top: 0%; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }

        .hero-section { display: flex; flex-direction: column; gap: 20px; }
        .hero-title { font-size: 64px; font-weight: 800; letter-spacing: -0.05em; color: var(--text-primary); line-height: 1.1; }
        .gradient-text { background: var(--accent-flow); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .hero-subtitle { font-size: 20px; color: var(--text-secondary); max-width: 520px; margin: 0 auto; opacity: 0.8; }

        .templates-section { width: 100%; }
        .template-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; width: 100%; }
        .template-pill { 
          padding: 28px; 
          text-align: left; 
          position: relative; 
          overflow: hidden; 
          transition: all 0.5s var(--spring); 
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .template-pill:hover { transform: translateY(-6px) scale(1.02); box-shadow: var(--shadow-deep); border-color: var(--accent-primary); background: #FFF; }
        .q-text { font-size: 16px; font-weight: 600; color: var(--text-primary); z-index: 2; position: relative; }
        .q-hover-aura { 
          position: absolute; inset: 0; 
          background: radial-gradient(circle at var(--x, 50%) var(--y, 50%), rgba(255, 92, 0, 0.08), transparent 70%);
          opacity: 0; transition: opacity 0.4s;
        }
        .template-pill:hover .q-hover-aura { opacity: 1; }
      `}</style>
    </div>
  );

  const getPartArgs = (part: any) => part?.args || part?.input || part?.invocation?.args || {};
  const getPartOutput = (part: any) => part?.output || part?.result;

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
        const isLastPart = i === (parts.length - 1);
        const isActive = isLoading && isLastPart;
        
        return (
          <div key={`part-reasoning-${i}`} className="part-unit reasoning-container-wrapper animate-fade-in">
            <ReasoningBlock 
              text={part.text} 
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
        
        // 预览结果可能在 output 中（如果已执行）或在 args 中（如果是待确认状态）
        const displayData = output || args;
        const hasMeaningfulPreview = !!(
          displayData?.sql ||
          displayData?.explanation ||
          displayData?.lineage ||
          displayData?.plan
        );
        const hasLaterPreview = parts
          .slice(i + 1)
          .some((nextPart) => (nextPart as any).type === 'tool-previewQueryPlan');

        if (!hasMeaningfulPreview || (!output && hasLaterPreview)) {
          return null;
        }

        const previewKey = toolPart?.toolCallId || `preview-${i}`;
        const executionState = executedPreviews[previewKey];
        const hasDownstreamExecution = parts
          .slice(i + 1)
          .some((nextPart) => isExecutionPartType((nextPart as any).type));
        const isExecutable = !!displayData?.plan && !hasDownstreamExecution;
        const isExecuting = executionState?.status === 'loading';
        const isExecuted = executionState?.status === 'success';
        
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
                debugRaw={{ output: { audit: { lineage: displayData?.lineage, plan: displayData?.plan } } }}
              />

              {renderPreviewExecution(previewKey, executionState)}

              {(!hasDownstreamExecution && (!output || output?.requires_action)) && (
                <div className="preview-actions">
                  <button 
                    className={`confirm-btn soft-surface ${isExecuted ? 'is-done' : ''}`}
                    disabled={!isExecutable || isExecuting || isExecuted}
                    onClick={() => executePreviewPlan(previewKey, displayData)}
                  >
                    {isExecuting ? <Loader2 size={14} className="spin-slow" /> : isExecuted ? <CheckCircle2 size={14} /> : <Zap size={14} />}
                    <span>{isExecuting ? '执行中...' : isExecuted ? '已执行' : isExecutable ? '确认并执行' : '无法执行'}</span>
                  </button>
                  <button 
                    className="cancel-btn soft-surface"
                    disabled={isExecuting || isExecuted}
                    onClick={() => safeSendMessage({ text: "我不确定，请重新调整" })}
                  >
                    <AlertCircle size={14} />
                    <span>重新调整</span>
                  </button>
                </div>
              )}
            </div>
            <style jsx>{`
              .preview-container {
                background: rgba(255, 255, 255, 0.92);
                border: 1px solid var(--surface-border-strong);
                border-left: 3px solid var(--accent-primary);
                border-radius: 18px;
                padding: 20px;
                display: flex;
                flex-direction: column;
                gap: 16px;
                box-shadow: var(--shadow-soft);
              }
              .preview-label {
                display: flex;
                align-items: center;
                gap: 10px;
                font-family: var(--font-mono);
                font-size: 11px;
                font-weight: 800;
                color: var(--accent-primary);
                letter-spacing: 0.1em;
              }
              .preview-actions {
                display: flex;
                gap: 12px;
                margin-top: 4px;
              }
              .preview-execution {
                border-radius: 14px;
                border: 1px solid var(--surface-border);
                background: #FFFFFF;
              }
              .execution-loading,
              .execution-error {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 14px 16px;
                font-size: 13px;
                font-weight: 700;
                color: var(--text-secondary);
              }
              .execution-error {
                border-color: rgba(239, 68, 68, 0.2);
                color: var(--critical);
                background: rgba(239, 68, 68, 0.04);
              }
              .execution-ready {
                display: flex;
                flex-direction: column;
                gap: 14px;
                padding: 16px;
              }
              .execution-head {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
              }
              .execution-title {
                display: flex;
                align-items: center;
                gap: 8px;
                color: var(--success);
                font-size: 13px;
                font-weight: 800;
              }
              .execution-count {
                font-family: var(--font-mono);
                font-size: 10px;
                font-weight: 800;
                color: var(--text-tertiary);
                background: #F8FAFC;
                border: 1px solid #E2E8F0;
                border-radius: 999px;
                padding: 4px 10px;
                white-space: nowrap;
              }
              .execution-note,
              .empty-result {
                margin: 0;
                font-size: 13px;
                color: var(--text-secondary);
              }
              .preview-chart-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
                gap: 12px;
              }
              .spin-slow { animation: spin 1s linear infinite; }
              @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
              @media (max-width: 640px) {
                .preview-actions {
                  flex-direction: column;
                }
                .preview-container {
                  padding: 16px;
                }
                .preview-chart-grid {
                  grid-template-columns: 1fr;
                }
              }
              .confirm-btn {
                flex: 1;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 12px;
                padding: 16px;
                background: #0F172A;
                color: #FFF;
                border: none;
                border-radius: 16px;
                font-size: 15px;
                font-weight: 800;
                cursor: pointer;
                transition: all 0.4s var(--spring);
              }
              .confirm-btn:disabled,
              .cancel-btn:disabled {
                cursor: not-allowed;
                opacity: 0.62;
                transform: none !important;
                box-shadow: none;
              }
              .confirm-btn.is-done {
                background: var(--success);
              }
              .confirm-btn:not(:disabled):hover {
                background: #1E293B;
                transform: scale(1.03) translateY(-2px);
                box-shadow: 0 10px 20px rgba(0,0,0,0.1);
              }
              .cancel-btn {
                padding: 16px 28px;
                background: #FFFFFF;
                color: #64748B;
                border: 1px solid #E2E8F0;
                border-radius: 16px;
                font-size: 15px;
                font-weight: 700;
                cursor: pointer;
                transition: all 0.4s var(--spring);
              }
              .cancel-btn:not(:disabled):hover {
                background: #F8FAFC;
                color: #1E293B;
                transform: translateY(-2px);
              }
            `}</style>
          </div>
        );
      }

      case 'tool-semanticQuery':
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

      case 'tool-getSchema':
      case 'tool-getTableSamples':
      case 'tool-searchTables':
      case 'tool-listSemanticAtoms': {
        const toolPart = part as any;
        const state = toolPart?.state || 'unknown';
        if (state === 'result') return null; // 辅助工具的结果通常不需要直接展示在主流中
        const previousPart = parts[i - 1] as any;
        const previousWasUtility = previousPart && [
          'tool-getSchema',
          'tool-getTableSamples',
          'tool-searchTables',
          'tool-listSemanticAtoms'
        ].includes(previousPart.type);

        if (previousWasUtility) return null;
        
        return (
          <div key={`part-util-${i}`} className="part-unit util-part animate-fade-in">
            <div className="util-indicator">
              <Clock size={12} className="spin-slow" />
              <span>正在读取库表、样本与语义资产...</span>
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
                isPinned={pinnedCards.some(c => c.id === (toolPart?.toolCallId || `chart-${i}`))}
                onPin={() => handlePin({
                  id: toolPart?.toolCallId || `chart-${i}`,
                  type: 'chart',
                  title: output?.title,
                  data: output?.data,
                  chartType: output?.type === 'bar' ? 'bar' : 'area',
                })}
              />
            </div>
          </div>
        );
      }

      case 'tool-generateInsightCanvas': {
        const toolPart = part as any;
        if (!toolPart) return null;

        const output = getPartOutput(toolPart);
        const cards = output?.cards || getPartArgs(toolPart)?.cards || [];

        if (!cards.length) return <div key={`part-canvas-sk-${i}`} className="skeleton-card soft-surface" />;

        return (
          <div key={`part-canvas-${i}`} className="part-unit flow-part animate-fade-in">
            <div className="insight-grid">
              {cards.map((card: any, cardIdx: number) => (
                <InsightCard
                  key={card.id || `${toolPart?.toolCallId || 'canvas'}-${cardIdx}`}
                  id={card.id || `${toolPart?.toolCallId || 'canvas'}-${cardIdx}`}
                  type={card.type}
                  title={card.title}
                  description={card.explanation}
                  data={card.data || []}
                  chartType={card.chartType || 'bar'}
                  config={card.config}
                  compact={card.type !== 'table'}
                  onPin={() => handlePin(card)}
                />
              ))}
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
                          const clarificationIdx = parts.findIndex(p => p.type === 'tool-askClarification');
                          const previewIdx = parts.findIndex(p => p.type === 'tool-previewQueryPlan');
                          const hasExecutionAfterPreview = previewIdx !== -1 && parts
                            .slice(previewIdx + 1)
                            .some((nextPart) => isExecutionPartType((nextPart as any).type));
                          const stopCandidates = [
                            clarificationIdx,
                            previewIdx !== -1 && !hasExecutionAfterPreview ? previewIdx : -1,
                          ].filter(idx => idx !== -1);
                          const stopIdx = stopCandidates.length > 0 ? Math.min(...stopCandidates) : -1;
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
        .chat-col { flex: 1; display: flex; flex-direction: column; height: 100%; min-height: 0; min-width: 0; background: transparent; position: relative; }
        .stream-zone { flex: 1; min-height: 0; overflow-y: auto; scroll-behavior: smooth; }
        
        .message-list { max-width: 1000px; margin: 0 auto; padding: 80px 40px 180px; display: flex; flex-direction: column; gap: 64px; }
        
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
          position: relative;
          flex-shrink: 0;
          margin: 0 auto;
          width: 100%;
          max-width: 880px;
          padding: 0 40px 24px;
          z-index: 50;
        }
        
        .component-container { position: relative; display: flex; flex-direction: column; gap: 16px; }
        .insight-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; }
        .action-overlay { position: absolute; top: -12px; right: 12px; opacity: 0; transition: all 0.3s var(--spring); transform: translateY(4px); z-index: 20; }
        .component-container:hover .action-overlay { opacity: 1; transform: translateY(0); }
        .action-pill { display: flex; align-items: center; gap: 8px; padding: 10px 20px; font-size: 12px; font-weight: 700; color: var(--accent-primary); border-radius: 99px; }

        .skeleton-placeholder { height: 160px; border-radius: 24px; overflow: hidden; position: relative; }
        .sk-pulse { height: 100%; width: 100%; background: linear-gradient(90deg, transparent, rgba(99, 102, 241, 0.05), transparent); animation: sk-flow 2s infinite; }
        @keyframes sk-flow { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }

        .scroll-pills { position: absolute; bottom: 24px; left: 50%; transform: translateX(-50%); display: flex; align-items: center; gap: 10px; padding: 14px 28px; border-radius: 99px; font-size: 12px; font-weight: 700; color: var(--accent-primary); z-index: 100; }

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

        @media (max-width: 768px) {
          .message-list {
            padding: 72px 18px 150px;
            gap: 44px;
          }

          .input-zone {
            max-width: none;
            padding: 0 14px 14px;
          }

          .user-turn-inner {
            max-width: 92%;
          }

          .insight-grid {
            grid-template-columns: 1fr;
          }
        }


      `}</style>
    </WorkbenchLayout>
  );
}
