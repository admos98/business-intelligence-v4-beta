// src/components/charts/BarChart.tsx

import React, { useEffect, useRef } from 'react';

export interface BarChartData {
  label: string;
  value: number;
  color?: string;
}

interface BarChartProps {
  data: BarChartData[];
  width?: number;
  height?: number;
  showValues?: boolean;
  horizontal?: boolean;
}

export const BarChart: React.FC<BarChartProps> = ({
  data,
  width = 600,
  height = 400,
  showValues = true,
  horizontal = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    if (data.length === 0) return;

    const padding = 60;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;

    // Find max value
    const maxValue = Math.max(...data.map(d => Math.abs(d.value)));
    const scale = chartHeight / maxValue;

    // Draw axes
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 2;

    if (horizontal) {
      // Vertical axis (left)
      ctx.beginPath();
      ctx.moveTo(padding, padding);
      ctx.lineTo(padding, height - padding);
      ctx.stroke();

      // Horizontal axis (bottom)
      ctx.beginPath();
      ctx.moveTo(padding, height - padding);
      ctx.lineTo(width - padding, height - padding);
      ctx.stroke();
    } else {
      // Vertical axis (left)
      ctx.beginPath();
      ctx.moveTo(padding, padding);
      ctx.lineTo(padding, height - padding);
      ctx.stroke();

      // Horizontal axis (bottom)
      ctx.beginPath();
      ctx.moveTo(padding, height - padding);
      ctx.lineTo(width - padding, height - padding);
      ctx.stroke();
    }

    // Draw bars
    const barWidth = chartWidth / data.length;
    const barSpacing = barWidth * 0.2;
    const actualBarWidth = barWidth - barSpacing;

    data.forEach((item, index) => {
      const x = padding + index * barWidth + barSpacing / 2;
      const barHeight = Math.abs(item.value) * scale;
      const y = height - padding - barHeight;

      // Draw bar
      ctx.fillStyle = item.color || '#3b82f6';
      ctx.fillRect(x, y, actualBarWidth, barHeight);

      // Draw value on top
      if (showValues) {
        ctx.fillStyle = '#374151';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(
          item.value.toLocaleString(),
          x + actualBarWidth / 2,
          y - 5
        );
      }

      // Draw label
      ctx.fillStyle = '#6b7280';
      ctx.font = '11px Arial';
      ctx.textAlign = 'center';
      ctx.save();
      ctx.translate(x + actualBarWidth / 2, height - padding + 15);
      ctx.rotate(-Math.PI / 6);
      ctx.fillText(item.label, 0, 0);
      ctx.restore();
    });
  }, [data, width, height, showValues, horizontal]);

  return <canvas ref={canvasRef} width={width} height={height} className="max-w-full" />;
};
