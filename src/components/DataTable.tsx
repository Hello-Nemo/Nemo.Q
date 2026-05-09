'use client';

import React from 'react';
import { 
  Hash, 
  Type, 
  Calendar, 
  ChevronRight, 
  ArrowUpDown,
  MoreHorizontal,
  Table as TableIcon
} from 'lucide-react';

interface DataTableProps {
  rows: any[];
  rowCount?: number;
  onAction?: (row: any) => void;
}

export default function DataTable({ rows, rowCount, onAction }: DataTableProps) {
  if (!rows || rows.length === 0) return null;

  const columns = Object.keys(rows[0]);
  const hasRowAction = typeof onAction === 'function';

  const columnLabels: Record<string, string> = {
    user_country: '国家',
    country: '国家',
    sales_amount: '销售额',
    aov: '客单价',
    order_count: '订单量',
    user_count: '用户数',
    return_amount: '退货金额',
    total_price: '订单金额',
  };

  const labelFor = (key: string) => columnLabels[key] || key.replace(/_/g, ' ');

  const isNumericLike = (value: any) => {
    if (typeof value === 'number') return Number.isFinite(value);
    return typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value));
  };

  const isMoneyColumn = (key: string) => /amount|price|sales|aov|revenue|cost/i.test(key);

  const getColIcon = (key: string, value: any) => {
    if (isNumericLike(value)) return <Hash size={14} />;
    if (value instanceof Date || (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}/))) return <Calendar size={14} />;
    return <Type size={14} />;
  };

  const formatValue = (val: any) => {
    if (val === null || val === undefined) return <span className="null-label">NULL</span>;

    // 1. ISO Date String handling (e.g., 2024-03-31T16:00:00.000Z)
    if (typeof val === 'string' && val.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)) {
      const d = new Date(val);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('zh-CN', { 
          year: 'numeric', 
          month: '2-digit', 
          day: '2-digit' 
        });
      }
    }

    // 2. Number or Numeric String (Amount) handling
    // If it's a number, or a string that looks like a decimal amount (e.g., "100.00")
    if (isNumericLike(val)) {
      const num = Number(val);
      if (!isNaN(num)) {
        const formatted = num.toLocaleString('zh-CN', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2
        });
        return formatted;
      }
    }
    
    return String(val);
  };

  return (
    <div className="data-table-root soft-surface">
      <div className="table-top-bar">
        <div className="bar-info">
          <TableIcon size={16} className="info-icon" />
          <span className="info-text">{rowCount || rows.length} 数据记录</span>
        </div>
        <div className="bar-actions">
          <button className="util-btn"><MoreHorizontal size={16} /></button>
        </div>
      </div>

      <div className="table-scroller">
        <table className="organic-table">
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col}>
                  <div className="th-content">
                    <span className="th-icon">{getColIcon(col, rows[0][col])}</span>
                    <span className="th-label">{labelFor(col)}</span>
                    <ArrowUpDown size={12} className="sort-trigger" />
                  </div>
                </th>
              ))}
              {hasRowAction && <th className="action-th" />}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className={hasRowAction ? 'is-clickable' : ''} onClick={() => onAction?.(row)}>
                {columns.map((col) => {
                  const val = row[col];
                  return (
                    <td key={col} className={isNumericLike(val) ? 'num-cell' : ''}>
                      <span className="td-text">
                        {isMoneyColumn(col) && isNumericLike(val) ? '¥' : ''}{formatValue(val)}
                      </span>
                    </td>
                  );
                })}
                {hasRowAction && (
                  <td className="action-td">
                    <div className="action-hover-icon">
                      <ChevronRight size={16} />
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <style jsx>{`
        .data-table-root {
          width: 100%;
          overflow: hidden;
          background: #FFF;
          border: 1px solid rgba(0,0,0,0.03);
          display: flex;
          flex-direction: column;
        }

        .table-top-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 16px;
          background: rgba(0,0,0,0.01);
          border-bottom: 1px solid rgba(0,0,0,0.03);
        }
        .bar-info { display: flex; align-items: center; gap: 10px; }
        .info-icon { color: var(--accent-primary); }
        .info-text { font-size: 13px; font-weight: 700; color: var(--text-secondary); }
        .util-btn { color: var(--text-tertiary); padding: 4px; transition: color 0.3s; }
        .util-btn:hover { color: var(--accent-primary); }

        .table-scroller {
          overflow-x: auto;
          max-width: 100%;
        }

        .organic-table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
          min-width: 560px;
        }

        th {
          padding: 10px 16px;
          text-align: left;
          background: #FFF;
          border-bottom: 1px solid rgba(0,0,0,0.05);
          position: sticky;
          top: 0;
          z-index: 10;
        }
        .th-content { display: flex; align-items: center; gap: 8px; white-space: nowrap; }
        .th-icon { color: var(--text-tertiary); opacity: 0.7; }
        .th-label { font-size: 11px; font-weight: 800; color: var(--text-tertiary); letter-spacing: 0.02em; }
        .sort-trigger { color: var(--text-tertiary); opacity: 0; transition: opacity 0.2s; }
        th:hover .sort-trigger { opacity: 1; }

        td {
          padding: 8px 16px;
          font-size: 14px;
          color: var(--text-primary);
          border-bottom: 1px solid rgba(0,0,0,0.03);
          transition: background 0.3s ease;
        }
        .num-cell { text-align: right; font-variant-numeric: tabular-nums; font-weight: 600; }
        .null-label { color: var(--text-tertiary); font-style: italic; font-size: 12px; opacity: 0.5; }

        tr.is-clickable { cursor: pointer; }
        tr:hover td { background: rgba(0,0,0,0.01); }
        tr:hover .action-hover-icon { transform: translateX(4px); opacity: 1; color: var(--accent-primary); }

        .action-td { width: 48px; position: relative; }
        .action-hover-icon { 
          opacity: 0; 
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1); 
          color: var(--text-tertiary); 
        }

        .table-scroller::-webkit-scrollbar { height: 6px; }
        .table-scroller::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.05); border-radius: 3px; }
      `}</style>
    </div>
  );
}
