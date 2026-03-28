"use client";
import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts';

export default function RiskSparkline({ data, color }: { data: number[], color: string }) {
  const chartData = data.map((val, i) => ({ value: val, index: i }));
  
  return (
    <div className="w-24 h-8">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <YAxis domain={[0, 100]} hide />
          <Line 
            type="monotone" 
            dataKey="value" 
            stroke={color} 
            strokeWidth={2} 
            dot={false} 
            isAnimationActive={true} 
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
