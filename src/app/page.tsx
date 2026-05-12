'use client';

import dynamic from 'next/dynamic';
import React, { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo } from 'react';
import { 
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  AlertCircle
} from 'lucide-react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';

// 类型定义
import type { DataAgentUIMessage, TimestampedDataAgentUIMessage } from '@/lib/types';

// 错误边界
import { AppErrorBoundary } from '@/components/ErrorBoundary';

// 基础 UI 组件
import WorkbenchLayout from '@/components/WorkbenchLayout';
import InputArea from '@/components/InputArea';
import DecisionPrompt, { type DecisionOption } from '@/components/DecisionPrompt';

// 上下文与状态
import { useHistory } from '@/components/HistoryContext';
import { getCachedSessionMessages, getMessagesFingerprint } from '@/lib/session-state';
import { getActiveDecisionTarget, hasPendingDecision, isDecisionPartReady } from '@/lib/decision-state';
import { getPartArgs, getPartOutput, isExecutionPartType, buildClarificationOptions } from '@/lib/chat-utils';

// 自定义钩子 (Hooks)
import { useChatPersistence } from '@/hooks/use-chat-persistence';
import { useChatScroll } from '@/hooks/use-chat-scroll';
import { useCanvasResize } from '@/hooks/use-canvas-resize';
import { useQueryExecution } from '@/hooks/use-query-execution';

// 业务组件
import WelcomeView from '@/components/chat/WelcomeView';
import MessagePart from '@/components/chat/MessagePart';
import ModelSwitcher from '@/components/ModelSwitcher';

// 动态导入大型组件
const InsightCanvas = dynamic(() => import('@/components/InsightCanvas'), { ssr: false });
const ThinkingIndicator = dynamic(() => import('@/components/ThinkingIndicator'), { ssr: false });

/**
 * NEMO.Q 聊天主页面
 * 负责编排聊天流、会话管理、侧边栏画布交互以及所有自定义 Hook 的协同工作。
 */
export default function ChatPage() {
  // 1. 会话与历史管理
  const { currentSessionId, updateSession, createSession, sessions } = useHistory();
  const sessionsRef = useRef(sessions);
  useEffect(() => { sessionsRef.current = sessions; }, [sessions]);

  // 2. 状态定义
  const [pinnedCards, setPinnedCards] = useState<any[]>([]); // 已固定的图表卡片
  const [isCanvasOpen, setIsCanvasOpen] = useState(false);  // 画布展开状态
  const { canvasWidth, startResize } = useCanvasResize(480); // 画布尺寸调整

  // 3. 聊天核心配置 (AI SDK)
  const [selectedModel, setSelectedModel] = useState<string>('deepseek-v4-flash');
  const transport = useMemo(() => new DefaultChatTransport({ api: '/api/chat' }), []);
  const { messages, sendMessage, status, stop, error, setMessages } = useChat<TimestampedDataAgentUIMessage>({
    id: currentSessionId || 'new-session',
    messages: [],
    transport,
    body: {
      model: selectedModel
    }
  });

  // 4. 应用逻辑钩子
  // 消息持久化逻辑
  const { hydratedSnapshotRef, setMessageOwnerSessionId } = useChatPersistence({
    currentSessionId,
    messages,
    updateSession,
  });

  // 自动滚动控制
  const { scrollRef, isAutoScrollEnabled, setIsAutoScrollEnabled, handleScroll } = useChatScroll(messages, status);
  
  // SQL 查询执行管理
  const { executedPreviews, setExecutedPreviews, executePreviewPlan } = useQueryExecution(setMessages);

  /**
   * 还原会话消息历史
   */
  const hydrateMessages = useCallback((sessionId: string, nextMessages: TimestampedDataAgentUIMessage[]) => {
    if (hydratedSnapshotRef.current?.sessionId === sessionId &&
        hydratedSnapshotRef.current?.fingerprint === getMessagesFingerprint(nextMessages)) {
      return;
    }
    hydratedSnapshotRef.current = {
      sessionId,
      fingerprint: getMessagesFingerprint(nextMessages),
    };
    setMessageOwnerSessionId(sessionId);
    setMessages(nextMessages);
  }, [setMessages, setMessageOwnerSessionId, hydratedSnapshotRef]);

  /**
   * 监听会话切换
   */
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
    setExecutedPreviews({}); // 切换会话时重置本地执行状态
    setIsAutoScrollEnabled(true);
  }, [currentSessionId, createSession, hydrateMessages, setExecutedPreviews, setIsAutoScrollEnabled]);

  // 计算属性
  const isLoading = status === 'streaming' || status === 'submitted';
  const isDecisionPending = useMemo(() => hasPendingDecision(messages as any[]), [messages]);
  const activeDecisionTarget = useMemo(() => getActiveDecisionTarget(messages as any[]), [messages]);

  // 5. 交互处理
  const [isTrayReady, setIsTrayReady] = useState(false);
  useEffect(() => {
    if (isDecisionPending) {
      // 延迟显示决策托盘，等待消息片段动画完成
      const timer = setTimeout(() => setIsTrayReady(true), 1600);
      return () => clearTimeout(timer);
    } else {
      setIsTrayReady(false);
    }
  }, [isDecisionPending]);

  /**
   * 安全发送消息，处理流式输出冲突
   */
  const safeSendMessage = useCallback((params: { text: string }) => {
    if (isLoading) {
      stop();
      setTimeout(() => { sendMessage(params); }, 10);
      return;
    }
    sendMessage(params);
  }, [isLoading, stop, sendMessage]);

  /**
   * 固定/取消固定卡片到画布
   */
  const handlePin = useCallback((cardData: any) => {
    setPinnedCards(prev => {
      const existing = prev.find(c => c.id === cardData.id);
      if (existing) {
        return prev.filter(c => c.id !== cardData.id);
      }
      return [...prev, { ...cardData, isPinned: true }];
    });
    setIsCanvasOpen(true);
  }, []);

  /**
   * 表格行交互操作
   */
  const handleAction = useCallback((rowData: any) => {
    const summary = Object.entries(rowData).map(([k, v]) => `${k}: ${v}`).join(', ');
    safeSendMessage({ text: `针对这条记录深度分析其对业务的影响：${summary}` });
  }, [safeSendMessage]);

  /**
   * 计算当前激活的决策托盘内容（在输入框上方弹出）
   */
  const activeDecisionTray = useMemo(() => {
    if (!activeDecisionTarget) return null;

    const decisionMessage = messages[activeDecisionTarget.messageIndex] as any;
    const decisionPart = decisionMessage?.parts?.[activeDecisionTarget.partIndex] as any;
    if (!decisionPart) return null;

    if (decisionPart.type === 'tool-askClarification' && !isTrayReady) return null;

    const args = getPartArgs(decisionPart);

    // 情况 A: 澄清问题
    if (decisionPart.type === 'tool-askClarification') {
      return (
        <DecisionPrompt
          kind="clarification"
          surface="composer"
          question={args.question || '按哪个口径继续？'}
          options={buildClarificationOptions(args)}
          context={args.context || ''}
          status="pending"
          recommendedOptionValue={args.recommendedOptionValue}
          onSelect={(val) => safeSendMessage({ text: val === '跳过确认' ? '跳过确认' : `选择：${val}` })}
        />
      );
    }

    // 情况 B: 查询计划确认
    if (decisionPart.type === 'tool-previewQueryPlan') {
      const output = getPartOutput(decisionPart);
      const displayData = output || args;
      const previewKey = decisionPart?.toolCallId || `preview-${activeDecisionTarget.partIndex}`;
      const executionState = executedPreviews[previewKey];
      const isExecuting = executionState?.status === 'loading';
      const isExecutable = !!displayData?.plan && !displayData?.executionResult;
      
      const previewOptions: DecisionOption[] = [
        {
          label: isExecutable ? '确认并执行' : '无法执行',
          value: 'confirm_execute',
          description: isExecutable ? '按当前计划取数并展示结果' : '该预览缺少可执行查询计划',
          recommended: isExecutable,
          disabled: !isExecutable || isExecuting,
        },
        {
          label: '调整计划',
          value: 'request_revision',
          description: '补充口径或让 NEMO.Q 重新生成',
          disabled: isExecuting,
        },
      ];

      return (
        <DecisionPrompt
          kind="preview"
          surface="composer"
          question="这个查询计划可以执行吗？"
          context={displayData?.explanation}
          options={previewOptions}
          status={isExecuting ? 'executing' : 'pending'}
          onConfirmExecute={() => executePreviewPlan(previewKey, displayData)}
          onRequestRevision={() => safeSendMessage({ text: '我不确定，请重新调整' })}
        />
      );
    }

    return null;
  }, [activeDecisionTarget, messages, isTrayReady, executedPreviews, executePreviewPlan, safeSendMessage]);

  return (
    <WorkbenchLayout>
      {/* 氛围背景装饰 */}
      <div className="ambient-bg">
        <div className="aura-blob aura-1" />
        <div className="aura-blob aura-2" />
        <div className="aura-blob aura-3" />
      </div>

      {/* 左侧主聊天区域 */}
      <div className="chat-col">
        <div className="chat-header">
          <ModelSwitcher model={selectedModel} onChange={setSelectedModel} />
        </div>
        
        <div className="stream-zone" ref={scrollRef} onScroll={handleScroll}>
          {messages.length === 0 ? <WelcomeView onSendMessage={safeSendMessage} /> : (
            <div className="message-list">
              {messages.map((message, idx) => (
                <div key={message.id ? `msg-${message.id}-${idx}` : `msg-idx-${idx}`} className={`message-turn ${message.role}`}>
                  {message.role === 'user' ? (
                    /* 用户消息气泡 */
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
                    /* 助手消息内容 */
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
                          const clarificationIdx = parts.findIndex(p => p.type === 'tool-askClarification' && isDecisionPartReady(p as any));
                          const previewIdx = parts.findIndex(p => p.type === 'tool-previewQueryPlan' && isDecisionPartReady(p as any));
                          
                          // 逻辑：如果后面有执行结果，则当前的预览片段不再渲染确认交互
                          const hasExecutionAfterPreview = previewIdx !== -1 && parts.slice(previewIdx + 1).some((nextPart) => isExecutionPartType((nextPart as any).type));
                          const stopCandidates = [
                            clarificationIdx,
                            previewIdx !== -1 && !hasExecutionAfterPreview ? previewIdx : -1,
                          ].filter(idx => idx !== -1);
                          const stopIdx = stopCandidates.length > 0 ? Math.min(...stopCandidates) : -1;
                          const renderedParts = stopIdx !== -1 ? parts.slice(0, stopIdx + 1) : parts;
                          
                          return (
                            <>
                              {renderedParts.map((part, i, all) => (
                                <MessagePart
                                  key={`part-${idx}-${i}`}
                                  part={part}
                                  index={i}
                                  allParts={all}
                                  messageIndex={idx}
                                  messages={messages}
                                  isLoading={isLoading}
                                  executedPreviews={executedPreviews}
                                  pinnedCards={pinnedCards}
                                  onPin={handlePin}
                                  onAction={handleAction}
                                  onExecutePreview={executePreviewPlan}
                                />
                              ))}
                              {/* 思考状态指示器：仅在助手最后一条消息且尚未输出任何具体部分时展示 */}
                              {isLoading && idx === messages.length - 1 && parts.length === 0 && (
                                <div className="mt-4">
                                  <ThinkingIndicator />
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* 错误边界提示 */}
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
          
          {/* 自动滚动恢复按钮 */}
          {!isAutoScrollEnabled && messages.length > 0 && (
            <button onClick={() => setIsAutoScrollEnabled(true)} className="scroll-pills soft-surface">
              <ChevronDown size={14} />
              <span>最新洞察</span>
            </button>
          )}
        </div>

        {/* 底部输入区域 */}
        <div className="input-zone">
          <InputArea
            isStreaming={isLoading && !isDecisionPending}
            isDecisionPending={isDecisionPending}
            decisionTray={activeDecisionTray}
            onSend={(text) => safeSendMessage({ text })}
            onStop={() => stop()}
          />
        </div>
      </div>

      {/* 右侧洞察画布区域 */}
      {pinnedCards.length > 0 && (
        <div className={`canvas-col ${isCanvasOpen ? 'open' : 'collapsed'}`}
          style={isCanvasOpen ? { width: canvasWidth } : {}}
        >
          {/* 尺寸调整手柄 */}
          {isCanvasOpen && (
            <div className="resize-handle" onMouseDown={startResize}>
              <div className="handle-line" />
            </div>
          )}
          
          {/* 收起状态的触发标签 */}
          {!isCanvasOpen && (
            <button className="canvas-tab soft-surface" onClick={() => setIsCanvasOpen(true)}>
              <ChevronLeft size={16} />
              <div className="tab-badge">{pinnedCards.length}</div>
            </button>
          )}

          {/* 画布主内容框架 */}
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

      {/* 全局 Markdown 样式微调 */}
      <style jsx global>{`
        .md-part { font-size: 16px; line-height: 1.8; color: var(--text-primary); }
        .md-part p { margin-bottom: 16px; }
        .md-part strong { font-weight: 700; color: var(--accent-primary); }
        .md-part code { font-family: var(--font-mono); font-size: 13px; background: rgba(99, 102, 241, 0.05); padding: 3px 8px; border-radius: 6px; color: var(--accent-primary); }
        .md-part ul, .md-part ol { margin-bottom: 16px; padding-left: 20px; }
        .md-part li { margin-bottom: 8px; }
      `}</style>

      {/* 页面布局样式 */}
      <style jsx>{`
        .chat-col { flex: 1; display: flex; flex-direction: column; height: 100%; min-height: 0; min-width: 0; background: transparent; position: relative; }
        
        .chat-header {
          display: flex;
          align-items: center;
          padding: 12px 24px;
          flex-shrink: 0;
          z-index: 40;
        }

        .stream-zone { 
          flex: 1; 
          min-height: 0; 
          overflow-y: auto; 
          scroll-behavior: smooth;
        }
        
        .message-list { 
          max-width: 1000px; 
          margin: 0 auto; 
          padding: 80px 40px 60px; 
          display: flex; 
          flex-direction: column; 
          gap: 64px; 
        }
        
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

        .input-zone {
          position: relative;
          flex-shrink: 0;
          margin: 0 auto;
          width: 100%;
          max-width: 880px;
          padding: 0 40px 24px;
          z-index: 50;
        }
        
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

        .resize-handle {
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 4px;
          cursor: col-resize;
          z-index: 100;
          transition: background 0.2s;
        }
        .resize-handle:hover { background: rgba(99, 102, 241, 0.2); }
        .handle-line { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: 1px; height: 40px; background: var(--surface-border-strong); }

        @media (max-width: 768px) {
          .message-list { padding: 72px 18px 150px; gap: 44px; }
          .input-zone { max-width: none; padding: 0 14px 14px; }
          .user-turn-inner { max-width: 92%; }
        }
      `}</style>
    </WorkbenchLayout>
  );
}
