import { useState, useCallback } from 'react';
import { getPartOutput } from '@/lib/chat-utils';

/**
 * 查询计划执行状态定义
 */
export type PreviewExecutionState = {
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

/**
 * SQL 查询计划执行钩子
 * @param setMessages 用于更新消息列表中的工具执行状态和结果
 */
export function useQueryExecution(setMessages: (updater: (messages: any[]) => any[]) => void) {
  // 记录所有预览计划的执行状态，以 toolCallId 为 key
  const [executedPreviews, setExecutedPreviews] = useState<Record<string, PreviewExecutionState>>({});

  /**
   * 将执行结果同步回 messages 列表
   * 这样做可以保证页面刷新后执行状态能够被正确还原
   */
  const markPreviewPlanExecuted = useCallback((previewKey: string, displayData: any, result: any) => {
    setMessages((currentMessages) => currentMessages.map((message) => ({
      ...message,
      parts: message.parts.map((part: any) => {
        if (part?.toolCallId !== previewKey) return part;

        const existingOutput = getPartOutput(part) || {};
        return {
          ...part,
          output: {
            ...displayData,
            ...existingOutput,
            requires_action: false, // 标记此决策已完成
            selectedAnswer: '确认并执行',
            executionResult: result, // 注入执行结果
          },
        };
      }),
    })));
  }, [setMessages]);

  /**
   * 执行预览中的查询计划
   */
  const executePreviewPlan = useCallback(async (previewKey: string, displayData: any) => {
    const plan = displayData?.plan;

    if (!plan) {
      setExecutedPreviews(prev => ({
        ...prev,
        [previewKey]: {
          status: 'error',
          error: '该预览缺少可执行的查询计划 (QueryPlan)，请尝试重新生成。'
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
          explanation: displayData?.explanation || '用户确认执行查询计划。'
        })
      });

      const result = await response.json();

      if (!response.ok || result?.error) {
        throw new Error(result?.error || '查询执行异常');
      }

      // 更新本地执行状态
      setExecutedPreviews(prev => ({
        ...prev,
        [previewKey]: {
          status: 'success',
          result
        }
      }));

      // 同步到消息流
      markPreviewPlanExecuted(previewKey, displayData, result);
    } catch (err: any) {
      setExecutedPreviews(prev => ({
        ...prev,
        [previewKey]: {
          status: 'error',
          error: err?.message || '查询执行失败'
        }
      }));
    }
  }, [markPreviewPlanExecuted]);

  return {
    executedPreviews,
    setExecutedPreviews,
    executePreviewPlan
  };
}
