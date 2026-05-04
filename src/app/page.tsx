'use client';

import dynamic from 'next/dynamic';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useState, useRef, useEffect, useCallback } from 'react';
import { 
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  GripVertical,
  Activity,
  ShieldCheck,
  Clock,
  Layout,
  Cpu,
  Monitor,
  Maximize2,
  Download,
  AlertCircle
} from 'lucide-react';

import type { DataAgentUIMessage } from '@/lib/types';
import WorkbenchLayout from '@/components/WorkbenchLayout';
import InputArea from '@/components/InputArea';
import ReasoningBlock from '@/components/ReasoningBlock';

const DataTable = dynamic(() => import('@/components/DataTable'), { ssr: false });
const SqlAudit = dynamic(() => import('@/components/SqlAudit'), { ssr: false });
const ClarificationFlow = dynamic(() => import('@/components/ClarificationFlow'), { ssr: false });
const InsightCard = dynamic(() => import('@/components/InsightCard'), { ssr: false });
const InsightCanvas = dynamic(() => import('@/components/InsightCanvas'), { ssr: false });
const ThinkingIndicator = dynamic(() => import('@/components/ThinkingIndicator'), { ssr: false });

const SUGGESTED_QUESTIONS = [
  "分析各国家的销售额和客单价",
  "统计不同年龄段的用户数分布",
  "分析核心忠诚客户的表现",
  "找出最近退货率最高的产品类别",
];

export default function ChatPage() {
  const [pinnedCards, setPinnedCards] = useState<any[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(true);
  
  const [isCanvasOpen, setIsCanvasOpen] = useState(false);
  const [canvasWidth, setCanvasWidth] = useState(480);
  const isResizing = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);
  const isProgrammaticScroll = useRef(false);

  const { messages, sendMessage, status, stop, error } = useChat<DataAgentUIMessage>({
    transport: new DefaultChatTransport({ api: '/api/chat' }),
    experimental_throttle: 50,
    onError: (err) => {
      console.error('Chat error:', err);
    }
  });

  const isLoading = status === 'streaming' || status === 'submitted';

  // Expert Fix: Safety wrapper to prevent stream collisions
  const safeSendMessage = useCallback((params: { text: string }) => {
    if (isLoading) {
      stop();
    }
    // Small delay to ensure stop signal is processed if needed by transport
    // but usually calling it sequentially is enough for the hook state.
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
          <div className="brand-aura">
            <Cpu size={32} />
          </div>
          <div className="brand-text">
            <h1>Lumina AI</h1>
            <p>INTELLIGENT_FLUID_WORKBENCH / V4.0.0</p>
          </div>
        </div>

        <div className="hero-section">
          <h2 className="hero-title">
            <span className="gradient-text">探索数据</span>的无限可能
          </h2>
          <p className="hero-subtitle">自然、灵动、深邃。让 AI 助您洞察业务核心。</p>
        </div>

        <div className="status-row">
          <div className="mini-status soft-surface">
            <Activity size={14} className="icon-pulse" />
            <span>核心就绪</span>
          </div>
          <div className="mini-status soft-surface">
            <ShieldCheck size={14} />
            <span>语义同步</span>
          </div>
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
        
        .header-box { display: flex; flex-direction: column; align-items: center; gap: 16px; }
        .brand-aura { 
          width: 72px; height: 72px; 
          background: white; 
          border-radius: 24px; 
          display: flex; align-items: center; justify-content: center; 
          color: var(--accent-primary);
          box-shadow: 0 20px 40px rgba(99, 102, 241, 0.15);
          position: relative;
        }
        .brand-aura::after {
          content: ''; position: absolute; inset: -10px;
          background: var(--accent-flow); filter: blur(20px); opacity: 0.2; border-radius: 30px; z-index: -1;
        }
        .brand-text h1 { font-size: 24px; font-weight: 800; letter-spacing: -0.04em; }
        .brand-text p { font-family: var(--font-mono); font-size: 10px; font-weight: 800; color: var(--text-tertiary); letter-spacing: 0.2em; margin-top: 6px; }

        .hero-section { display: flex; flex-direction: column; gap: 16px; }
        .hero-title { font-size: 56px; font-weight: 800; letter-spacing: -0.05em; color: var(--text-primary); line-height: 1.1; }
        .gradient-text { background: var(--accent-flow); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .hero-subtitle { font-size: 18px; color: var(--text-secondary); max-width: 460px; margin: 0 auto; }

        .status-row { display: flex; gap: 12px; }
        .mini-status { padding: 8px 16px; display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 700; color: var(--text-secondary); border-radius: 99px; }
        .icon-pulse { color: var(--accent-primary); animation: breathe 2s infinite ease-in-out; }
        @keyframes breathe { 0%, 100% { opacity: 0.6; transform: scale(1); } 50% { opacity: 1; transform: scale(1.1); } }

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
        const args = toolPart.args || toolPart.input || toolPart.invocation?.args || {};
        
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

      case 'tool-executeQuery': {
        const toolPart = part as any;
        if (!toolPart) return null;

        const auditData = (toolPart.output as any)?.audit || {};
        const args = toolPart.input || 
                     toolPart.args || 
                     toolPart.invocation?.args || 
                     toolPart.parameters || 
                     toolPart.callArgs || 
                     toolPart.result?.args || 
                     {};
        
        const finalSql = auditData.sql || args.sql;
        const finalExplanation = auditData.explanation || args.explanation;
        const finalAssumptions = auditData.assumptions || args.assumptions;

        const state = toolPart.state || 'unknown';

        return (
          <div key={`part-query-${i}`} className="part-unit tool-part animate-fade-in">
            <div className="component-container">
              <SqlAudit 
                sql={finalSql} 
                explanation={finalExplanation} 
                assumptions={finalAssumptions} 
                isStreaming={state === 'call' && !toolPart.output} 
                debugRaw={toolPart}
              />
              
              <div className={`result-drawer ${state === 'output-available' || state === 'output-error' ? 'is-ready' : 'is-loading'}`}>
                {(toolPart.output as any)?.error || toolPart.errorText ? (
                  <div className="error-block soft-surface">
                    <AlertCircle size={18} />
                    <div className="error-info">
                      <span className="error-title">工具执行异常</span>
                      <p className="error-text">{(toolPart.output as any)?.error || toolPart.errorText}</p>
                    </div>
                  </div>
                ) : state === 'output-available' ? (
                  <div className="table-block">
                    <DataTable
                      rows={(toolPart.output as any)?.rows || []}
                      rowCount={(toolPart.output as any)?.rowCount}
                      onAction={handleAction}
                    />
                  </div>
                ) : (
                  <div className="skeleton-placeholder soft-surface">
                    <div className="sk-pulse" />
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      }

      case 'tool-render_chart': {
        const toolPart = part as any;
        if (!toolPart) return null;

        const output = toolPart.output as any;
        const state = toolPart.state || 'unknown';

        if (state !== 'output-available') return <div key={`part-chart-sk-${i}`} className="skeleton-card soft-surface" />;
        return (
          <div key={`part-chart-${i}`} className="part-unit chart-part animate-fade-in">
            <div className="component-container">
              <InsightCard
                id={toolPart.toolCallId}
                type="chart"
                title={output?.title || '图表'}
                description={output?.description}
                data={output?.data || []}
                chartType={output?.type === 'bar' ? 'bar' : 'area'}
                audit={output?.audit}
              />
              <div className="action-overlay">
                <button className="action-pill soft-surface" onClick={() => handlePin({
                  id: toolPart.toolCallId,
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
                      <div className="user-bubble">
                        {(message.parts.find(p => p.type === 'text') as any)?.text || ''}
                      </div>
                    </div>
                  ) : (
                    <div className="assistant-turn-content">
                      <div className="turn-meta">
                        <div className="agent-orb" />
                        <span className="agent-label">LUMINA_FLOW</span>
                        <div className="meta-sep" />
                        <span className="timestamp">{new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                      </div>
                      <div className="turn-body">
                        {(() => {
                          const parts = message.parts as DataAgentUIMessage['parts'];
                          const clarificationIdx = parts.findIndex(p => p.type === 'tool-askClarification');
                          const renderedParts = clarificationIdx !== -1 ? parts.slice(0, clarificationIdx + 1) : parts;
                          
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
                          <span className="agent-label">LUMINA_FLOW</span>
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
        .user-bubble { 
          max-width: 80%; 
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
