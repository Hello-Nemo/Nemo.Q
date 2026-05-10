import { useEffect, useRef, useState } from 'react';
import { getMessagesFingerprint, shouldPersistMessages, type MessagesSnapshot } from '@/lib/session-state';
import type { TimestampedDataAgentUIMessage } from '@/lib/types';

interface UseChatPersistenceProps {
  currentSessionId: string | null;
  messages: TimestampedDataAgentUIMessage[];
  updateSession: (sessionId: string, data: any) => Promise<void>;
}

/**
 * 聊天会话持久化钩子
 * 负责在消息流结束或会话切换时将消息状态同步到持久化层
 */
export function useChatPersistence({
  currentSessionId,
  messages,
  updateSession,
}: UseChatPersistenceProps) {
  // 记录消息所属的会话ID，防止跨会话保存导致的数据污染
  const [messageOwnerSessionId, setMessageOwnerSessionId] = useState<string | null>(currentSessionId);
  // 记录已持久化的消息快照，用于指纹对比
  const hydratedSnapshotRef = useRef<MessagesSnapshot | null>(null);

  /**
   * 同步当前会话 ID
   */
  useEffect(() => {
    if (!currentSessionId || messageOwnerSessionId === currentSessionId) return;
    setMessageOwnerSessionId(currentSessionId);
  }, [currentSessionId, messageOwnerSessionId]);

  /**
   * 自动保存逻辑
   */
  useEffect(() => {
    if (!currentSessionId) return;

    // 检查是否满足保存条件（例如：消息有变化且属于当前会话）
    if (!shouldPersistMessages({
      currentSessionId,
      messageOwnerSessionId,
      messages,
      hydratedSnapshot: hydratedSnapshotRef.current,
    })) return;

    const sessionId = currentSessionId;
    const fingerprint = getMessagesFingerprint(messages);
    
    // 判断是否为新对话的第一条消息（需要同步更新侧边栏标题）
    const isFirstMessage = messages.length === 1 && messages[0].role === 'user';
    
    const saveSession = async () => {
      let title: string | undefined;

      // 如果是第一轮对话，根据用户提问内容自动提取标题
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
      
      // 更新已保存的快照指纹
      hydratedSnapshotRef.current = { sessionId, fingerprint };
    };

    // 第一条消息立即保存，以保证 UI 及时响应
    if (isFirstMessage) {
      saveSession();
      return;
    }

    // 在流式输出过程中使用防抖保存，减少后端/存储压力
    const saveTimeout = setTimeout(saveSession, 1500);
    return () => clearTimeout(saveTimeout);
  }, [messages, currentSessionId, messageOwnerSessionId, updateSession]);

  return {
    messageOwnerSessionId,
    setMessageOwnerSessionId,
    hydratedSnapshotRef
  };
}
