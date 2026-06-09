'use client';

import { useRef, useState } from 'react';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
} from 'recharts';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';

// ── Types ──────────────────────────────────────────────────────────────────

export interface ChartSpec {
  id: string;
  title: string;
  subtitle: string;
  data: {
    label: string;
    revenue: number;
    growth: number;
    users: number;
  }[];
}

// ── Mock data ──────────────────────────────────────────────────────────────

export const QUARTERLY_CHART: Omit<ChartSpec, 'id'> = {
  title: 'Quarterly Performance',
  subtitle: 'Revenue (€M) · Growth rate (%) · Active users (K)',
  data: [
    { label: "Q1 '24", revenue: 1.2,  growth: 18, users: 4.2  },
    { label: "Q2 '24", revenue: 1.85, growth: 24, users: 6.1  },
    { label: "Q3 '24", revenue: 2.4,  growth: 31, users: 8.8  },
    { label: "Q4 '24", revenue: 3.1,  growth: 28, users: 11.2 },
    { label: "Q1 '25", revenue: 3.8,  growth: 22, users: 13.5 },
    { label: "Q2 '25", revenue: 4.6,  growth: 35, users: 17.3 },
  ],
};

// ── Custom tooltip ─────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  // Keep only named series (Area shares dataKey with Bar but has no name)
  const unique = payload.filter((e: { dataKey: string; name?: string }) => !!e.name);
  return (
    <div style={{
      background: 'oklch(100% 0 0)',
      border: '1px solid oklch(90% 0.006 263)',
      borderRadius: 10,
      padding: '10px 14px',
      boxShadow: '0 4px 20px oklch(0% 0 0 / 0.1)',
      fontSize: '0.8125rem',
      animation: 'tooltip-in 0.15s cubic-bezier(0.23, 1, 0.32, 1)',
    }}>
      <p style={{ margin: '0 0 8px', fontWeight: 600, color: 'oklch(12% 0.004 263)', letterSpacing: '-0.01em' }}>
        {label}
      </p>
      {unique.map((entry: { dataKey: string; name: string; value: number; color: string }) => (
        <div key={entry.dataKey} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: entry.color as string, flexShrink: 0 }} />
          <span style={{ color: 'oklch(54% 0.006 263)' }}>{entry.name}</span>
          <span style={{ marginLeft: 'auto', fontWeight: 500, color: 'oklch(12% 0.004 263)', paddingLeft: 12 }}>
            {entry.dataKey === 'revenue' ? `€${entry.value}M` :
             entry.dataKey === 'growth'  ? `${entry.value}%`  :
                                           `${entry.value}K`  }
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Export helpers ─────────────────────────────────────────────────────────

function svgToPngCanvas(svgEl: SVGElement): Promise<HTMLCanvasElement> {
  return new Promise((resolve) => {
    const box  = svgEl.getBoundingClientRect();
    const w    = Math.round(box.width)  || 800;
    const h    = Math.round(box.height) || 400;
    const data = new XMLSerializer().serializeToString(svgEl);
    const blob = new Blob([data], { type: 'image/svg+xml;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const img  = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width  = w * 2; // 2× for retina
      canvas.height = h * 2;
      const ctx = canvas.getContext('2d')!;
      ctx.scale(2, 2);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(canvas);
    };
    img.src = url;
  });
}

async function exportPNG(wrapperEl: HTMLDivElement | null, filename: string) {
  if (!wrapperEl) return;
  const svg = wrapperEl.querySelector<SVGElement>('svg');
  if (!svg) return;
  const canvas = await svgToPngCanvas(svg);
  const a = document.createElement('a');
  a.download = filename;
  a.href = canvas.toDataURL('image/png');
  a.click();
}

async function exportPDF(wrapperEl: HTMLDivElement | null, title: string) {
  if (!wrapperEl) return;
  const svg = wrapperEl.querySelector<SVGElement>('svg');
  if (!svg) return;
  const canvas = await svgToPngCanvas(svg);
  const imgData = canvas.toDataURL('image/png');
  const pdf  = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pW   = pdf.internal.pageSize.getWidth();
  const pH   = pdf.internal.pageSize.getHeight();
  // Header
  pdf.setFontSize(14);
  pdf.setTextColor(30, 30, 40);
  pdf.text(title, 14, 16);
  pdf.setFontSize(9);
  pdf.setTextColor(120, 120, 140);
  pdf.text(`Exported ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`, 14, 22);
  // Chart image
  const imgH = (pH - 36) * 0.85;
  const imgW = pW - 28;
  pdf.addImage(imgData, 'PNG', 14, 28, imgW, imgH);
  pdf.save(`${title.toLowerCase().replace(/\s+/g, '-')}.pdf`);
}

function exportExcel(data: ChartSpec['data'], title: string) {
  const rows = data.map(d => ({
    Quarter:       d.label,
    'Revenue (€M)': d.revenue,
    'Growth (%)'  : d.growth,
    'Users (K)'   : d.users,
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [{ wch: 10 }, { wch: 14 }, { wch: 12 }, { wch: 10 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Data');
  XLSX.writeFile(wb, `${title.toLowerCase().replace(/\s+/g, '-')}.xlsx`);
}

// ── Export button ──────────────────────────────────────────────────────────

function ExportBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '4px 11px', borderRadius: 6,
        border: '1px solid oklch(90% 0.006 263)',
        background: 'transparent',
        color: 'oklch(54% 0.006 263)',
        fontSize: '0.6875rem', fontWeight: 500, cursor: 'pointer',
        transition: 'all 0.13s',
        letterSpacing: '0.01em',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = 'oklch(37% 0.185 263)';
        e.currentTarget.style.color = 'white';
        e.currentTarget.style.borderColor = 'oklch(37% 0.185 263)';
        e.currentTarget.style.boxShadow = '0 0 12px oklch(37% 0.185 263 / 0.3)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'transparent';
        e.currentTarget.style.color = 'oklch(54% 0.006 263)';
        e.currentTarget.style.borderColor = 'oklch(90% 0.006 263)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      {label}
    </button>
  );
}

// ── Stat card ──────────────────────────────────────────────────────────────

function Stat({ label, value, delta }: { label: string; value: string; delta: string }) {
  const positive = delta.startsWith('+');
  return (
    <div style={{
      flex: 1,
      background: 'oklch(98% 0.003 263)',
      border: '1px solid oklch(94% 0.004 263)',
      borderRadius: 10, padding: '12px 14px',
    }}>
      <p style={{ margin: '0 0 4px', fontSize: '0.6875rem', color: 'oklch(54% 0.006 263)', fontWeight: 500 }}>{label}</p>
      <p style={{ margin: '0 0 2px', fontSize: '1.125rem', fontWeight: 650, letterSpacing: '-0.02em', color: 'oklch(12% 0.004 263)' }}>{value}</p>
      <p style={{ margin: 0, fontSize: '0.6875rem', color: positive ? 'oklch(50% 0.15 155)' : 'oklch(52% 0.18 25)', fontWeight: 500 }}>{delta} vs prev</p>
    </div>
  );
}

// ── ChartPanel ─────────────────────────────────────────────────────────────

export default function ChartPanel({ chart, onClose }: { chart: ChartSpec; onClose: () => void }) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [activeBar, setActiveBar] = useState<string | null>(null);

  const last  = chart.data[chart.data.length - 1];
  const prev  = chart.data[chart.data.length - 2];
  const revDelta = `+${(((last.revenue - prev.revenue) / prev.revenue) * 100).toFixed(0)}%`;
  const uDelta   = `+${(((last.users   - prev.users)   / prev.users)   * 100).toFixed(0)}%`;

  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      background: 'oklch(100% 0 0)',
      animation: 'panel-in 0.32s cubic-bezier(0.23, 1, 0.32, 1) forwards',
    }}>

      {/* Header */}
      <div style={{
        height: 52, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 18px',
        borderBottom: '1px solid oklch(94% 0.004 263)',
      }}>
        <div>
          <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, letterSpacing: '-0.015em', color: 'oklch(12% 0.004 263)' }}>
            {chart.title}
          </p>
          <p style={{ margin: 0, fontSize: '0.625rem', color: 'oklch(54% 0.006 263)' }}>
            {chart.subtitle}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <ExportBtn label="PNG"  onClick={() => exportPNG(wrapperRef.current, 'chart')} />
          <ExportBtn label="PDF"  onClick={() => exportPDF(wrapperRef.current, chart.title)} />
          <ExportBtn label="XLS"  onClick={() => exportExcel(chart.data, chart.title)} />

          <div style={{ width: 1, height: 18, background: 'oklch(90% 0.006 263)', margin: '0 2px' }} />

          <button
            onClick={onClose}
            aria-label="Close chart"
            style={{
              width: 28, height: 28, borderRadius: 7,
              border: '1px solid oklch(90% 0.006 263)',
              background: 'transparent', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'oklch(54% 0.006 263)',
              transition: 'all 0.13s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'oklch(96% 0.004 263)';
              e.currentTarget.style.color = 'oklch(12% 0.004 263)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'oklch(54% 0.006 263)';
            }}
          >
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">
              <path d="M1 1l9 9M10 1L1 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'flex', gap: 10, padding: '14px 18px 0', flexShrink: 0 }}>
        <Stat label="Revenue Q2 '25"   value={`€${last.revenue}M`} delta={revDelta} />
        <Stat label="Growth rate"       value={`${last.growth}%`}   delta={`+${last.growth - prev.growth}pp`} />
        <Stat label="Active users"      value={`${last.users}K`}    delta={uDelta} />
      </div>

      {/* Chart */}
      <div
        ref={wrapperRef}
        style={{ flex: 1, padding: '16px 10px 10px 4px', minHeight: 0 }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chart.data} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
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
              tick={{ fontSize: 11, fill: 'oklch(60% 0.006 263)', fontFamily: 'inherit' }}
              axisLine={false}
              tickLine={false}
              dy={6}
            />

            <YAxis
              yAxisId="rev"
              orientation="left"
              tick={{ fontSize: 11, fill: 'oklch(60% 0.006 263)', fontFamily: 'inherit' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={v => `€${v}M`}
              dx={-4}
            />

            <YAxis
              yAxisId="pct"
              orientation="right"
              tick={{ fontSize: 11, fill: 'oklch(65% 0.13 75)', fontFamily: 'inherit' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={v => `${v}%`}
              dx={4}
            />

            <Tooltip
              content={<ChartTooltip />}
              cursor={{ fill: 'oklch(37% 0.185 263 / 0.05)' }}
            />

            {/* Area under bars for depth */}
            <Area
              yAxisId="rev"
              dataKey="revenue"
              type="monotone"
              fill="url(#revenueGrad)"
              stroke="none"
              animationDuration={900}
              animationEasing="ease-out"
            />

            <Bar
              yAxisId="rev"
              dataKey="revenue"
              name="Revenue"
              fill="oklch(37% 0.185 263)"
              radius={[5, 5, 0, 0]}
              maxBarSize={40}
              animationDuration={700}
              animationEasing="ease-out"
              onMouseEnter={(_, index) => setActiveBar(String(index))}
              onMouseLeave={() => setActiveBar(null)}
            />

            <Line
              yAxisId="pct"
              dataKey="growth"
              name="Growth"
              type="monotone"
              stroke="oklch(58% 0.14 75)"
              strokeWidth={2.5}
              dot={{ fill: 'oklch(58% 0.14 75)', strokeWidth: 0, r: 4 }}
              activeDot={{ r: 6, fill: 'oklch(58% 0.14 75)', stroke: 'white', strokeWidth: 2 }}
              animationDuration={900}
              animationEasing="ease-out"
              animationBegin={200}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Footer */}
      <div style={{
        padding: '6px 18px 10px', flexShrink: 0,
        borderTop: '1px solid oklch(94% 0.004 263)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{ fontSize: '0.5625rem', color: 'oklch(70% 0.004 263)' }}>
          Roger · Data updated {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
        </span>
        <span style={{ fontSize: '0.5625rem', color: 'oklch(70% 0.004 263)' }}>
          Figures are illustrative
        </span>
      </div>
    </div>
  );
}
