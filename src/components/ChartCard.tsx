'use client';

import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import type { ChartSpec } from './ChartPanel';

// ── AI summary generator ───────────────────────────────────────────────────

export function generateSummary(spec: ChartSpec): string {
  const { data } = spec;
  const first = data[0];
  const last  = data[data.length - 1];
  const prev  = data[data.length - 2];

  const totalGrowth = Math.round(((last.revenue - first.revenue) / first.revenue) * 100);
  const qoqGrowth   = Math.round(((last.revenue - prev.revenue) / prev.revenue) * 100);
  const peakEntry   = data.reduce((a, b) => a.growth > b.growth ? a : b);
  const dipEntry    = data.reduce((a, b) => a.growth < b.growth ? a : b);
  const hasDip      = dipEntry.label !== peakEntry.label;

  const line1 = `Revenue grew **${totalGrowth}%** from ${first.label} to ${last.label}, reaching **€${last.revenue}M** (+${qoqGrowth}% QoQ).`;
  const line2 = hasDip
    ? `Growth peaked at **${peakEntry.growth}%** in ${peakEntry.label}, with a dip to **${dipEntry.growth}%** in ${dipEntry.label}.`
    : `Growth rate peaked at **${peakEntry.growth}%** in ${peakEntry.label}.`;

  return `${line1} ${line2}`;
}

// ── Inline tooltip (minimal, card-sized) ───────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CardTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const byKey = new Map<string, typeof payload[0]>();
  payload.forEach((e: { dataKey: string }) => byKey.set(e.dataKey, e));
  const unique = Array.from(byKey.values());
  return (
    <div style={{
      background: 'oklch(100% 0 0)',
      border: '1px solid oklch(90% 0.006 263)',
      borderRadius: 8,
      padding: '7px 10px',
      boxShadow: '0 4px 16px oklch(0% 0 0 / 0.1)',
      fontSize: '0.6875rem',
    }}>
      <p style={{ margin: '0 0 5px', fontWeight: 600, color: 'oklch(12% 0.004 263)' }}>{label}</p>
      {unique.map((entry: { dataKey: string; value: number; color: string }) => (
        <div key={entry.dataKey} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: entry.color, flexShrink: 0 }} />
          <span style={{ color: 'oklch(54% 0.006 263)' }}>
            {entry.dataKey === 'revenue' ? `€${entry.value}M` : `${entry.value}%`}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── ChartCard ──────────────────────────────────────────────────────────────

export default function ChartCard({
  chart,
  onExpand,
  timestamp,
}: {
  chart: ChartSpec;
  onExpand: () => void;
  timestamp?: Date;
}) {
  return (
    <div
      style={{
        width: 300,
        borderRadius: 12,
        border: '1px solid oklch(90% 0.006 263)',
        background: 'oklch(100% 0 0)',
        boxShadow: '0 2px 16px oklch(0% 0 0 / 0.07)',
        overflow: 'hidden',
        animation: 'panel-in 0.32s cubic-bezier(0.23, 1, 0.32, 1) forwards',
      }}
    >
      {/* Header */}
      <div style={{ padding: '16px 18px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <p style={{
            margin: 0, fontSize: '0.75rem', fontWeight: 650,
            letterSpacing: '-0.01em', color: 'oklch(12% 0.004 263)',
          }}>
            {chart.title}
          </p>
          {timestamp && (
            <p style={{ margin: '1px 0 0', fontSize: '0.5625rem', color: 'oklch(65% 0.004 263)' }}>
              {timestamp.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
            </p>
          )}
        </div>
        <span style={{
          fontSize: '0.5625rem', fontWeight: 500,
          color: 'oklch(45% 0.15 263)',
          background: 'oklch(95% 0.025 263)',
          border: '1px solid oklch(87% 0.04 263)',
          borderRadius: 99, padding: '2px 7px',
          marginTop: 1, flexShrink: 0,
        }}>
          Chart
        </span>
      </div>

      {/* Full chart */}
      <div style={{ height: 190, padding: '0 12px 0 4px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chart.data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={`cardGrad-${chart.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="oklch(37% 0.185 263)" stopOpacity={0.18} />
                <stop offset="95%" stopColor="oklch(37% 0.185 263)" stopOpacity={0.02} />
              </linearGradient>
            </defs>

            <CartesianGrid
              vertical={false}
              stroke="oklch(93% 0.004 263)"
              strokeDasharray="4 4"
            />

            <XAxis
              dataKey="label"
              tick={{ fontSize: 9, fill: 'oklch(60% 0.006 263)', fontFamily: 'inherit' }}
              axisLine={false}
              tickLine={false}
              dy={4}
            />

            <YAxis
              yAxisId="rev"
              orientation="left"
              tick={{ fontSize: 9, fill: 'oklch(45% 0.15 263)', fontFamily: 'inherit' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={v => `€${v}M`}
              width={32}
              dx={-2}
            />

            <YAxis
              yAxisId="pct"
              orientation="right"
              tick={{ fontSize: 9, fill: 'oklch(58% 0.14 75)', fontFamily: 'inherit' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={v => `${v}%`}
              width={26}
              dx={2}
            />

            <Tooltip
              content={<CardTooltip />}
              cursor={{ fill: 'oklch(37% 0.185 263 / 0.05)' }}
            />

            <Area
              yAxisId="rev"
              dataKey="revenue"
              type="monotone"
              fill={`url(#cardGrad-${chart.id})`}
              stroke="none"
              animationDuration={800}
              animationEasing="ease-out"
            />

            <Bar
              yAxisId="rev"
              dataKey="revenue"
              name="Revenue"
              fill="oklch(37% 0.185 263)"
              radius={[3, 3, 0, 0]}
              maxBarSize={28}
              animationDuration={650}
              animationEasing="ease-out"
            />

            <Line
              yAxisId="pct"
              dataKey="growth"
              name="Growth"
              type="monotone"
              stroke="oklch(58% 0.14 75)"
              strokeWidth={2}
              dot={{ fill: 'oklch(58% 0.14 75)', strokeWidth: 0, r: 3 }}
              activeDot={{ r: 5, fill: 'oklch(58% 0.14 75)', stroke: 'white', strokeWidth: 1.5 }}
              animationDuration={800}
              animationEasing="ease-out"
              animationBegin={150}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Expand button */}
      <div style={{ padding: '10px 18px 16px' }}>
        <button
          onClick={onExpand}
          style={{
            width: '100%', padding: '6px 0',
            borderRadius: 7, border: '1px solid oklch(90% 0.006 263)',
            background: 'transparent', cursor: 'pointer',
            color: 'oklch(54% 0.006 263)', fontSize: '0.6875rem', fontWeight: 500,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            transition: 'all 0.13s cubic-bezier(0.23, 1, 0.32, 1)',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'oklch(37% 0.185 263)';
            e.currentTarget.style.color = 'white';
            e.currentTarget.style.borderColor = 'oklch(37% 0.185 263)';
            e.currentTarget.style.boxShadow = '0 0 14px oklch(37% 0.185 263 / 0.3)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = 'oklch(54% 0.006 263)';
            e.currentTarget.style.borderColor = 'oklch(90% 0.006 263)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
            <rect x="1" y="4.5" width="2" height="4.5" rx="0.5" fill="currentColor" />
            <rect x="4" y="2.5" width="2" height="6.5" rx="0.5" fill="currentColor" />
            <rect x="7" y="1" width="2" height="8" rx="0.5" fill="currentColor" />
          </svg>
          Open full chart
        </button>
      </div>
    </div>
  );
}
