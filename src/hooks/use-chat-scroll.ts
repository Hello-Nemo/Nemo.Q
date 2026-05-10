import { useState, useRef, useEffect, useCallback } from 'react';

/**
 * 聊天界面自动滚动钩子
 * @param messages 消息列表，变化时触发滚动
 * @param status 聊天状态（streaming/submitted等），状态变化时控制滚动行为
 */
export function useChatScroll(messages: any[], status: string) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(true);
  const isProgrammaticScroll = useRef(false);

  /**
   * 处理手动滚动事件
   * 用于检测用户是否向上滚动以关闭自动滚动
   */
  const handleScroll = useCallback(() => {
    // 如果是程序触发的滚动，则忽略此事件
    if (isProgrammaticScroll.current) {
      isProgrammaticScroll.current = false;
      return;
    }

    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    
    // 判断是否滚动到了底部（允许50px误差）
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    
    // 同步自动滚动开启状态
    setIsAutoScrollEnabled(prev => prev !== isAtBottom ? isAtBottom : prev);
  }, []);

  /**
   * 监听消息和状态变化，执行滚动动作
   */
  useEffect(() => {
    if (!isAutoScrollEnabled || !scrollRef.current) return;
    
    const container = scrollRef.current;
    
    // 在流式输出过程中强制置底
    if (status === 'streaming' || status === 'submitted') {
      isProgrammaticScroll.current = true;
      container.scrollTop = container.scrollHeight;
    } else {
      // 最终更新采用平滑滚动
      isProgrammaticScroll.current = true;
      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages, isAutoScrollEnabled, status]);

  /**
   * 监听容器尺寸变化（如由于 InputArea 增长导致的布局变化）
   */
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    let rafId: number;
    const observer = new ResizeObserver(() => {
      if (isAutoScrollEnabled && scrollRef.current) {
        cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => {
          if (scrollRef.current) {
            isProgrammaticScroll.current = true;
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
          }
        });
      }
    });

    observer.observe(container);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(rafId);
    };
  }, [isAutoScrollEnabled]);

  return {
    scrollRef,
    isAutoScrollEnabled,
    setIsAutoScrollEnabled,
    handleScroll
  };
}
