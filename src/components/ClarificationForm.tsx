import React, { useState } from 'react';

interface ClarificationFormProps {
  question: string;
  options?: string[];
  context?: string;
  onSubmit: (answer: string) => void;
}

const ClarificationForm: React.FC<ClarificationFormProps> = ({ question, options, context, onSubmit }) => {
  const [customAnswer, setCustomAnswer] = useState('');

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (customAnswer.trim()) {
      onSubmit(customAnswer);
    }
  };

  return (
    <div className="clarification-wrapper">
      <div className="clarification-header">
        <span className="icon">🤔</span>
        <span className="title">需要您进一步确认</span>
      </div>
      
      <div className="clarification-body">
        <h3 className="question">{question}</h3>
        {context && <p className="context">业务上下文：{context}</p>}

        {options && options.length > 0 && (
          <div className="options-grid">
            {options.map((opt) => (
              <button 
                key={opt} 
                className="option-chip"
                onClick={() => onSubmit(opt)}
              >
                {opt}
              </button>
            ))}
          </div>
        )}

        <form className="custom-input-group" onSubmit={handleSubmit}>
          <input 
            type="text" 
            placeholder="或者在此输入您的补充说明..."
            value={customAnswer}
            onChange={(e) => setCustomAnswer(e.target.value)}
          />
          <button type="submit" disabled={!customAnswer.trim()}>确认</button>
        </form>
      </div>

      <style jsx>{`
        .clarification-wrapper {
          margin: 1.5rem 0;
          background: var(--background);
          border: 2px solid var(--primary);
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 10px 30px rgba(0, 112, 243, 0.15);
          animation: slideUp 0.4s ease-out;
        }

        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        .clarification-header {
          background: var(--primary);
          color: white;
          padding: 0.75rem 1.25rem;
          display: flex;
          align-items: center;
          gap: 10px;
          font-weight: 600;
          font-size: 0.9rem;
        }

        .clarification-body {
          padding: 1.5rem;
        }

        .question {
          font-size: 1.1rem;
          margin-bottom: 0.75rem;
          color: var(--foreground);
        }

        .context {
          font-size: 0.85rem;
          color: #666;
          margin-bottom: 1.5rem;
          padding: 0.75rem;
          background: rgba(0,0,0,0.03);
          border-radius: 8px;
          border-left: 4px solid #ccc;
        }

        .options-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-bottom: 1.5rem;
        }

        .option-chip {
          background: white;
          border: 1px solid var(--primary);
          color: var(--primary);
          padding: 0.6rem 1.2rem;
          border-radius: 30px;
          cursor: pointer;
          font-size: 0.9rem;
          transition: all 0.2s;
        }

        .option-chip:hover {
          background: var(--primary);
          color: white;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 112, 243, 0.2);
        }

        .custom-input-group {
          display: flex;
          gap: 10px;
          margin-top: 1rem;
        }

        .custom-input-group input {
          flex: 1;
          border: 1px solid var(--border);
          padding: 0.75rem 1rem;
          border-radius: 8px;
          font-size: 0.9rem;
        }

        .custom-input-group button {
          padding: 0.75rem 1.5rem;
          background: var(--primary);
          color: white;
          border-radius: 8px;
          border: none;
          cursor: pointer;
        }
      `}</style>
    </div>
  );
};

export default ClarificationForm;
