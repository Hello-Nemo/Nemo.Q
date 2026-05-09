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

const COLORS = ['#FF5C00', '#1E1B4B', '#FF8A00', '#475569', '#FFB400', '#10B981'];

export default function Chart({ type, title, description, data, xAxisKey, yAxisKey, onAction }: ChartProps) {
  const [isReady, setIsReady] = React.useState(false);

  React.useEffect(() => {
    // Recharts ResponsiveContainer needs a tick to calculate dimensions properly
    const timer = setTimeout(() => {
      setIsReady(true);
      if (typeof window !== 'undefined') {
        // Delay resize event to allow DOM to settle
        setTimeout(() => window.dispatchEvent(new Event('resize')), 100);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  const handleClick = (payload: any) => {
    if (onAction && payload && payload.activePayload && payload.activePayload[0]) {
      onAction(payload.activePayload[0].payload);
    } else if (onAction && payload && payload.payload) {
      onAction(payload.payload);
    }
  };

  const xKey = xAxisKey || (data && data.length > 0 ? Object.keys(data[0])[0] : 'name');
  const yKey = yAxisKey || (data && data.length > 0 ? Object.keys(data[0])[1] : 'value');

  const renderChart = () => {
    if (!isReady) return null;

    switch (type) {
      case 'line':
        return (
          <LineChart data={data} onClick={handleClick}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
            <XAxis 
              dataKey={xKey} 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#94A3B8', fontSize: 12 }}
            />
            <YAxis 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#94A3B8', fontSize: 12 }}
            />
            <Tooltip 
              contentStyle={{ 
                borderRadius: '12px', 
                border: 'none', 
                boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                padding: '12px'
              }}
            />
            <Legend iconType="circle" />
            <Line
              type="monotone"
              dataKey={yKey}
              stroke="#FF5C00"
              strokeWidth={3}
              dot={{ r: 4, fill: '#FF5C00', strokeWidth: 2, stroke: '#fff' }}
              activeDot={{ r: 6, strokeWidth: 0 }}
            />
          </LineChart>
        );
      case 'bar':
        return (
          <BarChart data={data} onClick={handleClick}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
            <XAxis 
              dataKey={xKey} 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#94A3B8', fontSize: 12 }}
            />
            <YAxis 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#94A3B8', fontSize: 12 }}
            />
            <Tooltip 
              contentStyle={{ 
                borderRadius: '12px', 
                border: 'none', 
                boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                padding: '12px'
              }}
            />
            <Legend iconType="circle" />
            <Bar dataKey={yKey} fill="#FF5C00" radius={[6, 6, 0, 0]} style={{ cursor: 'pointer' }} />
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
              paddingAngle={8}
              dataKey={yKey}
              nameKey={xKey}
              onClick={handleClick}
              style={{ cursor: 'pointer' }}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip 
              contentStyle={{ 
                borderRadius: '12px', 
                border: 'none', 
                boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                padding: '12px'
              }}
            />
            <Legend iconType="circle" />
          </PieChart>
        );
      default:
        return null;
    }
  };

  return (
    <div className="chart-wrapper" style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="chart-header">
        <h3 className="chart-title">{title}</h3>
        {description && <p className="chart-desc">{description}</p>}
      </div>
      <div className="chart-container" style={{ width: '100%', height: 320, position: 'relative', flexGrow: 1 }}>
        {isReady && (
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            {renderChart() as React.ReactElement}
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
