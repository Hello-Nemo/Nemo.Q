'use client';

import React from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface ChartProps {
  type: 'line' | 'bar' | 'pie';
  title: string;
  description?: string;
  data: any[];
  xAxisKey: string;
  yAxisKey: string;
  onAction?: (data: any) => void;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export default function Chart({ type, title, description, data, xAxisKey, yAxisKey, onAction }: ChartProps) {
  const handleClick = (payload: any) => {
    if (onAction && payload && payload.activePayload && payload.activePayload[0]) {
      onAction(payload.activePayload[0].payload);
    } else if (onAction && payload && payload.payload) {
      onAction(payload.payload);
    }
  };

  const renderChart = () => {
    switch (type) {
      case 'line':
        return (
          <LineChart data={data} onClick={handleClick}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
            <XAxis dataKey={xAxisKey} axisLine={false} tickLine={false} />
            <YAxis axisLine={false} tickLine={false} />
            <Tooltip 
              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey={yAxisKey}
              stroke="#0070f3"
              strokeWidth={3}
              dot={{ r: 4, fill: '#0070f3', cursor: 'pointer' }}
              activeDot={{ r: 6, strokeWidth: 0 }}
            />
          </LineChart>
        );
      case 'bar':
        return (
          <BarChart data={data} onClick={handleClick}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
            <XAxis dataKey={xAxisKey} axisLine={false} tickLine={false} />
            <YAxis axisLine={false} tickLine={false} />
            <Tooltip 
              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
            />
            <Legend />
            <Bar dataKey={yAxisKey} fill="#0070f3" radius={[4, 4, 0, 0]} style={{ cursor: 'pointer' }} />
          </BarChart>
        );
      case 'pie':
        return (
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={5}
              dataKey={yAxisKey}
              nameKey={xAxisKey}
              onClick={handleClick}
              style={{ cursor: 'pointer' }}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip 
              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
            />
            <Legend />
          </PieChart>
        );
      default:
        return null;
    }
  };

  return (
    <div className="chart-wrapper">
      <div className="chart-header">
        <h3 className="chart-title">{title}</h3>
        {description && <p className="chart-desc">{description}</p>}
      </div>
      <div style={{ width: '100%', height: 300 }}>
        <ResponsiveContainer width="100%" height="100%">
          {renderChart() as React.ReactElement}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
