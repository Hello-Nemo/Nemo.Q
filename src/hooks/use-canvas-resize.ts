import { useState, useRef, useCallback } from 'react';

/**
 * 画布尺寸动态调整钩子
 * @param initialWidth 初始宽度
 */
export function useCanvasResize(initialWidth: number = 480) {
  const [canvasWidth, setCanvasWidth] = useState(initialWidth);
  const isResizing = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  /**
   * 开始调整尺寸的处理函数
   * 绑定鼠标移动和松开事件到全局窗口
   */
  const startResize = useCallback((e: React.MouseEvent) => {
    isResizing.current = true;
    startX.current = e.clientX;
    startWidth.current = canvasWidth;
    
    // 设置全局样式防止选择文本并改变指针
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMove = (ev: MouseEvent) => {
      if (!isResizing.current) return;
      // 计算偏移量（右侧边栏，向左拉是增加宽度）
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

  return {
    canvasWidth,
    setCanvasWidth,
    startResize
  };
}
