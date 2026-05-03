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

  const getColIcon = (key: string, value: any) => {
    if (typeof value === 'number') return <Hash size={14} />;
    if (value instanceof Date || (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}/))) return <Calendar size={14} />;
    return <Type size={14} />;
  };

  const formatValue = (val: any) => {
    if (typeof val === 'number') return val.toLocaleString();
    if (val === null || val === undefined) return <span className="null-label">NULL</span>;
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
                    <span className="th-label">{col}</span>
                    <ArrowUpDown size={12} className="sort-trigger" />
                  </div>
                </th>
              ))}
              <th className="action-th" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} onClick={() => onAction?.(row)}>
                {columns.map((col) => {
                  const val = row[col];
                  return (
                    <td key={col} className={typeof val === 'number' ? 'num-cell' : ''}>
                      <span className="td-text">{formatValue(val)}</span>
                    </td>
                  );
                })}
                <td className="action-td">
                  <div className="action-hover-icon">
                    <ChevronRight size={16} />
                  </div>
                </td>
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
          padding: 16px 24px;
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
        }

        th {
          padding: 16px 24px;
          text-align: left;
          background: #FFF;
          border-bottom: 1px solid rgba(0,0,0,0.05);
          position: sticky;
          top: 0;
          z-index: 10;
        }
        .th-content { display: flex; align-items: center; gap: 8px; }
        .th-icon { color: var(--text-tertiary); opacity: 0.7; }
        .th-label { font-size: 11px; font-weight: 800; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.05em; }
        .sort-trigger { color: var(--text-tertiary); opacity: 0; transition: opacity 0.2s; }
        th:hover .sort-trigger { opacity: 1; }

        td {
          padding: 14px 24px;
          font-size: 14px;
          color: var(--text-primary);
          border-bottom: 1px solid rgba(0,0,0,0.03);
          transition: background 0.3s ease;
        }
        .num-cell { text-align: right; font-variant-numeric: tabular-nums; font-weight: 600; }
        .null-label { color: var(--text-tertiary); font-style: italic; font-size: 12px; opacity: 0.5; }

        tr { cursor: pointer; }
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
