'use client';

import React from 'react';
import { ErrorBoundary as ReactErrorBoundary } from 'react-error-boundary';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface ErrorFallbackProps {
  error: Error;
  resetErrorBoundary: () => void;
}

function ErrorFallback({ error, resetErrorBoundary }: ErrorFallbackProps) {
  return (
    <div className="error-boundary-container">
      <div className="error-boundary-content">
        <div className="error-icon">
          <AlertCircle size={48} color="#ef4444" />
        </div>
        
        <h2 className="error-title">应用出错了</h2>
        
        <p className="error-description">
          抱歉，应用遇到了一个意外错误。您可以尝试刷新页面或联系技术支持。
        </p>
        
        <details className="error-details">
          <summary>错误详情</summary>
          <pre className="error-stack">
            {error.message}
            {process.env.NODE_ENV === 'development' && error.stack && (
              <>
                {'\n\n'}
                {error.stack}
              </>
            )}
          </pre>
        </details>
        
        <div className="error-actions">
          <button 
            onClick={resetErrorBoundary}
            className="error-button error-button-primary"
          >
            <RefreshCw size={16} />
            重试
          </button>
          
          <button 
            onClick={() => window.location.href = '/'}
            className="error-button error-button-secondary"
          >
            返回首页
          </button>
        </div>
      </div>

      <style jsx>{`
        .error-boundary-container {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          padding: 2rem;
          background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
        }

        .error-boundary-content {
          max-width: 600px;
          width: 100%;
          background: white;
          border-radius: 16px;
          padding: 3rem;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.1);
          text-align: center;
        }

        .error-icon {
          margin-bottom: 1.5rem;
          display: flex;
          justify-content: center;
        }

        .error-title {
          font-size: 1.75rem;
          font-weight: 700;
          color: #1e293b;
          margin-bottom: 1rem;
        }

        .error-description {
          font-size: 1rem;
          color: #64748b;
          line-height: 1.6;
          margin-bottom: 2rem;
        }

        .error-details {
          text-align: left;
          margin-bottom: 2rem;
          background: #f8fafc;
          border-radius: 8px;
          padding: 1rem;
        }

        .error-details summary {
          cursor: pointer;
          font-weight: 600;
          color: #475569;
          user-select: none;
        }

        .error-details summary:hover {
          color: #1e293b;
        }

        .error-stack {
          margin-top: 1rem;
          padding: 1rem;
          background: #1e293b;
          color: #e2e8f0;
          border-radius: 6px;
          font-size: 0.875rem;
          line-height: 1.5;
          overflow-x: auto;
          white-space: pre-wrap;
          word-break: break-word;
        }

        .error-actions {
          display: flex;
          gap: 1rem;
          justify-content: center;
        }

        .error-button {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1.5rem;
          border-radius: 8px;
          font-weight: 600;
          font-size: 0.875rem;
          cursor: pointer;
          transition: all 0.2s;
          border: none;
        }

        .error-button-primary {
          background: #3b82f6;
          color: white;
        }

        .error-button-primary:hover {
          background: #2563eb;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
        }

        .error-button-secondary {
          background: #f1f5f9;
          color: #475569;
        }

        .error-button-secondary:hover {
          background: #e2e8f0;
          transform: translateY(-1px);
        }

        @media (max-width: 640px) {
          .error-boundary-content {
            padding: 2rem;
          }

          .error-title {
            font-size: 1.5rem;
          }

          .error-actions {
            flex-direction: column;
          }

          .error-button {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </div>
  );
}

interface AppErrorBoundaryProps {
  children: React.ReactNode;
}

/**
 * 应用级错误边界
 * 捕获所有未处理的 React 错误，防止白屏
 */
export function AppErrorBoundary({ children }: AppErrorBoundaryProps) {
  const handleError = (error: Error, info: { componentStack: string }) => {
    console.error('[ErrorBoundary] Caught error:', error);
    console.error('[ErrorBoundary] Component stack:', info.componentStack);
    
    // 可以在这里发送错误到监控服务
    // 例如：Sentry.captureException(error, { contexts: { react: info } });
  };

  const handleReset = () => {
    // 清理可能导致错误的状态
    try {
      // 清理 localStorage 中的临时数据
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('temp_')) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
    } catch (e) {
      console.warn('Failed to clear localStorage:', e);
    }
  };

  return (
    <ReactErrorBoundary
      FallbackComponent={ErrorFallback}
      onError={handleError}
      onReset={handleReset}
    >
      {children}
    </ReactErrorBoundary>
  );
}
