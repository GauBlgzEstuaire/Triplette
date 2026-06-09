'use client';

import { ResponsiveContainer, BarChart, Bar, XAxis } from 'recharts';
import RichText from './RichText';
import type { ChartSpec } from './ChartPanel';

// ── AI summary generator ───────────────────────────────────────────────────
// Derives a 1–2 sentence insight from the chart data

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
      <div style={{ padding: '12px 14px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
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

      {/* Mini bar sparkline */}
      <div style={{ height: 72, padding: '10px 6px 0' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chart.data} margin={{ top: 0, right: 0, bottom: 0, left: 0 }} barCategoryGap="25%">
            <Bar dataKey="revenue" fill="oklch(37% 0.185 263)" radius={[3, 3, 0, 0]} animationDuration={600} />
            <XAxis dataKey="label" tick={false} axisLine={false} tickLine={false} height={0} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* AI-generated summary */}
      <div style={{ padding: '10px 14px 0', fontSize: '0.75rem', lineHeight: 1.55, color: 'oklch(36% 0.008 263)' }}>
        <RichText content={generateSummary(chart)} />
      </div>

      {/* Expand button */}
      <div style={{ padding: '10px 14px 14px' }}>
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
