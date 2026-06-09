'use client';

import { useState, useRef, useEffect, useCallback, KeyboardEvent } from 'react';
import ChartPanel, { QUARTERLY_CHART, type ChartSpec } from './ChartPanel';
import ChartCard, { generateSummary } from './ChartCard';
import RichText from './RichText';

// ── Types ──────────────────────────────────────────────────────────────────

type Role   = 'user' | 'agent';
type Status = 'idle' | 'thinking' | 'error';

interface Message {
  id: string;
  role: Role;
  text: string;
  ts: Date;
  chartId?: string;
}

// ── Dummy conversation data ────────────────────────────────────────────────

const CHART_TRIGGERS = [
  'show me our quarterly performance',
  'show me a chart',
  'show me a performance chart',
  'revenue chart',
  'quarterly performance',
];

const EXCHANGES: [string, string][] = [
  [
    'Show me our quarterly performance',
    `📊 Here's a breakdown of your last **6 quarters** of performance.

[success] Revenue reached **€4.6M in Q2 '25** — a **+21%** jump from Q1, the strongest quarter on record.

### Key metrics
- **Revenue growth:** +283% from Q1 '24 to Q2 '25
- **Growth rate:** 35% — up **+13pp** from Q1's dip to 22%
- **Active users:** 17.3K, adding **3.8K** net new this quarter

[warning] The **Q4 '24 growth dip to 28%** is worth investigating — revenue held but momentum slowed for one quarter before recovering strongly.

User acquisition has consistently outpaced revenue, suggesting strong retention and **upsell potential** ahead.`,
  ],
  [
    'Help me plan a product launch',
    `Good starting point. Before tactics, I need three things.

### Three questions first
- **Who is this for?** Existing users, a new segment, or both?
- **What does success look like in 30 days?** Pick one metric — not five.
- **What's the one thing competitors aren't doing** that you could own?

[info] Start with whichever one you have the clearest answer to — that's your anchor. Everything else will follow from it.`,
  ],
  [
    'Review this strategy and find the gaps',
    `I can do that. Share the document or describe the strategy in your own words — whatever is faster.

[warning] Before I review it: **what has already been challenged internally?** Knowing which assumptions the team is confident about vs. still open will help me focus on the real gaps, not the obvious ones.

### What I'll look for
- **Coverage gaps** — areas the strategy doesn't address at all
- **Assumption risk** — claims that aren't validated by data
- **Priority conflicts** — where the plan pulls in two directions at once`,
  ],
  [
    'Help me prepare for a difficult conversation',
    `Let's make this concrete.

[info] Most difficult conversations break down at the same point: the gap between **what you need** and **what the other person wants**. That's where to focus.

Two things to start:
- **Who is the conversation with,** and what outcome do you need?
- **What do you think they want?** Their version of a good outcome.

Once I have both sides, we can work through the framing and anticipate where it gets hard.`,
  ],
  [
    "Summarize my week and prioritize what's left",
    `Walk me through it — what shipped, what got stuck, and what you didn't get to.

### How to frame it
- **Shipped** — anything delivered, reviewed, or handed off ✅
- **Stuck** — work in progress that hit a blocker 🔄
- **Not started** — planned but didn't happen ❌

[warning] Don't filter yet — just list everything. I'll help you sort what actually needs to happen before Friday vs. what can safely move to next week.`,
  ],
  [
    "What's the most important thing I should focus on today?",
    `That depends on one thing: **what does a good day look like at 6pm?**

[info] Not the whole list — just the **one thing** that would make you feel like today was worth it. Tell me that, and we'll work backwards.

Most people have 3–5 things that feel urgent. Usually **only one actually matters today** — the rest can wait or delegate.`,
  ],
  [
    'Can you help me write a job description?',
    `Yes. Tell me about the role — not the formal requirements, but **the problem this person is being hired to solve.**

[success] The best job descriptions describe **outcomes, not responsibilities.** "Own the growth loop from acquisition to activation" beats "Manage marketing campaigns."

### What we'll cover
- **The 90-day success story** — what does great look like early on?
- **Must-haves vs. nice-to-haves** — most JDs inflate both
- **The honest section** — what's genuinely hard about this role right now?`,
  ],
  [
    'I have a board meeting next week',
    `Let's get you ready. Three questions to anchor the prep:

### Board prep framework
- **What do they most need to understand** that they currently don't? 🎯
- **What's the one decision you need from them?** Be specific.
- **What are you most worried they'll push back on?** Name it now.

[warning] Board prep is mostly about **anticipating the hard questions** before they ask them. If you can't answer something clearly in the room, practice it here first.

[info] The goal isn't to cover everything — it's to **control the narrative** on the 2–3 things that matter most this quarter.`,
  ],
];

const FALLBACK_REPLIES = [
  "That's a useful frame. What's the most important constraint you're working within?",
  "Understood. Walk me through what you've already tried or ruled out.",
  "Good. Who else is involved in this decision, and where do they stand?",
  "Worth separating the immediate problem from the underlying need. Which one are we solving first?",
  "Makes sense. What does success look like in 30 days?",
  "I want to make sure I understand the stakes. What happens if nothing changes?",
];

const STARTERS = [
  { label: 'Performance', text: 'Show me our quarterly performance' },
  { label: 'Plan',        text: 'Help me plan a product launch' },
  { label: 'Review',      text: 'Review this strategy and find the gaps' },
  { label: 'Prepare',     text: 'Help me prepare for a difficult conversation' },
];

// ── Constants ──────────────────────────────────────────────────────────────

const ACCENT         = 'oklch(37% 0.185 263)';
const ACCENT_H       = 'oklch(32% 0.185 263)';
// Height of the gradient+input area at the bottom (blend zone + input)
const BOTTOM_OVERLAY = 230;

// Multi-stop gradient that approximates an ease-in curve:
// near-invisible at the top, gradually solidifying toward the input.
const BOTTOM_GRADIENT = [
  'transparent                      0%',
  'oklch(42% 0.16 263 / 0.03)      12%',
  'oklch(41% 0.165 263 / 0.10)     24%',
  'oklch(40% 0.17 263  / 0.24)     37%',
  'oklch(39% 0.175 263 / 0.46)     51%',
  'oklch(38% 0.18 263  / 0.70)     65%',
  'oklch(37% 0.185 263 / 0.88)     78%',
  'oklch(37% 0.185 263             ) 90%',
].join(', ');

// Shared easing strings
const EASE_OUT    = 'cubic-bezier(0.23, 1, 0.32, 1)';
const EASE_SPRING = 'cubic-bezier(0.34, 1.56, 0.64, 1)';

// ── Helpers ────────────────────────────────────────────────────────────────

const clock = (d: Date) =>
  d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

function isChartQuery(text: string): boolean {
  const t = text.toLowerCase().trim();
  return CHART_TRIGGERS.some(trigger => t.includes(trigger));
}

function pickReply(text: string, index: number): string {
  const match = EXCHANGES.find(([q]) =>
    q.toLowerCase().trim() === text.toLowerCase().trim()
  );
  return match ? match[1] : FALLBACK_REPLIES[index % FALLBACK_REPLIES.length];
}

// ── Avatar ─────────────────────────────────────────────────────────────────

const AVATAR_BG =
  'radial-gradient(circle at 38% 34%, oklch(55% 0.16 248), oklch(37% 0.19 263) 55%, oklch(24% 0.14 278))';

function Avatar({ size = 26, dark = false }: { size?: number; dark?: boolean }) {
  return (
    <div aria-hidden="true" style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: AVATAR_BG,
      boxShadow: dark
        ? '0 0 0 1.5px oklch(100% 0 0 / 0.28)'
        : '0 0 0 1px oklch(37% 0.185 263 / 0.2)',
    }} />
  );
}

// ── Status pill ────────────────────────────────────────────────────────────

function StatusPill({ status, dark = false }: { status: Status; dark?: boolean }) {
  const dot =
    status === 'idle'     ? (dark ? 'oklch(72% 0.2 155)' : 'var(--color-green)')  :
    status === 'thinking' ? (dark ? 'oklch(80% 0.16 75)'  : 'var(--color-amber)') :
                            (dark ? 'oklch(72% 0.2 25)'   : 'var(--color-red)');
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 9px', borderRadius: 99,
      background: dark ? 'oklch(100% 0 0 / 0.12)' : 'var(--color-raised)',
      border:     dark ? '1px solid oklch(100% 0 0 / 0.18)' : '1px solid var(--color-border)',
      fontSize: '0.6875rem', fontWeight: 500,
      color: dark ? 'oklch(100% 0 0 / 0.82)' : 'var(--color-ink-3)',
    }}>
      <span style={{
        width: 5, height: 5, borderRadius: '50%', background: dot, flexShrink: 0,
        boxShadow: status === 'idle' ? `0 0 6px ${dot}` : 'none',
      }} />
      {status === 'idle' ? 'Online' : status === 'thinking' ? 'Thinking' : 'Error'}
    </span>
  );
}

// ── Top bar ────────────────────────────────────────────────────────────────

function TopBar({
  status, chartCount, chartsOpen, onNew, onToggleCharts,
}: {
  status: Status; chartCount: number; chartsOpen: boolean;
  onNew: () => void; onToggleCharts: () => void;
}) {
  return (
    <header style={{
      height: 52, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 20px',
      background: ACCENT,
      borderBottom: '1px solid oklch(100% 0 0 / 0.1)',
      zIndex: 10,
      animation: `topbar-in 0.42s ${EASE_OUT} both`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Avatar size={22} dark />
        <span style={{ fontSize: '0.9375rem', fontWeight: 600, letterSpacing: '-0.018em', color: 'white' }}>
          Roger
        </span>
        <StatusPill status={status} dark />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {chartCount > 0 && (
          <button
            onClick={onToggleCharts}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '5px 11px', borderRadius: 7,
              border: '1px solid oklch(100% 0 0 / 0.25)',
              background: chartsOpen ? 'oklch(100% 0 0 / 0.18)' : 'transparent',
              color: 'white', fontSize: '0.75rem', fontWeight: 500, cursor: 'pointer',
              transition: 'all 0.15s cubic-bezier(0.23, 1, 0.32, 1)',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'oklch(100% 0 0 / 0.18)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = chartsOpen ? 'oklch(100% 0 0 / 0.18)' : 'transparent'; }}
          >
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">
              <rect x="1" y="5" width="2" height="5" rx="0.5" fill="currentColor" />
              <rect x="4.5" y="3" width="2" height="7" rx="0.5" fill="currentColor" />
              <rect x="8" y="1" width="2" height="9" rx="0.5" fill="currentColor" />
            </svg>
            My Charts
            <span style={{
              background: 'oklch(100% 0 0 / 0.9)', color: ACCENT,
              borderRadius: 99, fontSize: '0.5625rem', fontWeight: 700,
              padding: '1px 5px', lineHeight: 1.4,
            }}>
              {chartCount}
            </span>
          </button>
        )}

        <button
          onClick={onNew}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '5px 11px', borderRadius: 7,
            border: '1px solid oklch(100% 0 0 / 0.25)', background: 'transparent',
            color: 'oklch(100% 0 0 / 0.82)', fontSize: '0.75rem', fontWeight: 500, cursor: 'pointer',
            transition: 'all 0.15s cubic-bezier(0.23, 1, 0.32, 1)',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'oklch(100% 0 0 / 0.15)'; e.currentTarget.style.color = 'white'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'oklch(100% 0 0 / 0.82)'; }}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
            <path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          New
        </button>
      </div>
    </header>
  );
}

// ── My Charts panel ────────────────────────────────────────────────────────

function MyChartsPanel({
  charts, chartTimestamps, onClose, onExpand,
}: {
  charts: Record<string, ChartSpec>;
  chartTimestamps: Record<string, Date>;
  onClose: () => void;
  onExpand: (id: string) => void;
}) {
  const entries = Object.values(charts);
  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, zIndex: 40,
        background: 'oklch(0% 0 0 / 0.12)',
        animation: 'fade-in 0.2s ease-out',
      }} />
      <div style={{
        position: 'fixed', top: 52, right: 0,
        width: 380, height: 'calc(100dvh - 52px)',
        background: 'oklch(100% 0 0)',
        borderLeft: '1px solid oklch(90% 0.006 263)',
        boxShadow: '-12px 0 40px oklch(0% 0 0 / 0.08)',
        zIndex: 50, display: 'flex', flexDirection: 'column',
        animation: 'slide-in-right 0.3s cubic-bezier(0.23, 1, 0.32, 1)',
      }}>
        <div style={{
          height: 52, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 18px', borderBottom: '1px solid oklch(94% 0.004 263)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
              <rect x="1" y="6" width="3" height="6" rx="0.7" fill={ACCENT} />
              <rect x="5" y="3.5" width="3" height="8.5" rx="0.7" fill={ACCENT} />
              <rect x="9" y="1" width="3" height="11" rx="0.7" fill={ACCENT} />
            </svg>
            <span style={{ fontSize: '0.875rem', fontWeight: 600, letterSpacing: '-0.015em', color: 'oklch(12% 0.004 263)' }}>
              My Charts
            </span>
            <span style={{
              background: ACCENT, color: 'white',
              borderRadius: 99, fontSize: '0.5625rem', fontWeight: 700, padding: '2px 6px', lineHeight: 1.4,
            }}>
              {entries.length}
            </span>
          </div>
          <button onClick={onClose} aria-label="Close" style={{
            width: 28, height: 28, borderRadius: 7,
            border: '1px solid oklch(90% 0.006 263)', background: 'transparent', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'oklch(54% 0.006 263)', transition: 'all 0.13s',
          }}
            onMouseEnter={e => { e.currentTarget.style.background = 'oklch(96% 0.004 263)'; e.currentTarget.style.color = 'oklch(12% 0.004 263)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'oklch(54% 0.006 263)'; }}
          >
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">
              <path d="M1 1l9 9M10 1L1 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {entries.map(chart => (
            <div key={chart.id} style={{
              borderRadius: 10, border: '1px solid oklch(93% 0.004 263)',
              background: 'oklch(99% 0.002 263)', overflow: 'hidden',
            }}>
              <div style={{ padding: '12px 14px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ margin: 0, fontSize: '0.8125rem', fontWeight: 650, letterSpacing: '-0.01em', color: 'oklch(12% 0.004 263)' }}>
                    {chart.title}
                  </p>
                  <p style={{ margin: '2px 0 0', fontSize: '0.5625rem', color: 'oklch(65% 0.004 263)' }}>
                    {chartTimestamps[chart.id]
                      ? chartTimestamps[chart.id].toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                      : 'Today'}
                  </p>
                </div>
                <span style={{
                  fontSize: '0.5625rem', fontWeight: 500, color: 'oklch(45% 0.15 263)',
                  background: 'oklch(95% 0.025 263)', border: '1px solid oklch(87% 0.04 263)',
                  borderRadius: 99, padding: '2px 7px', marginTop: 1,
                }}>Chart</span>
              </div>
              <div style={{ padding: '0 14px 10px', fontSize: '0.75rem', lineHeight: 1.55, color: 'oklch(36% 0.008 263)' }}>
                <RichText content={generateSummary(chart)} />
              </div>
              <div style={{ padding: '0 14px 12px' }}>
                <button
                  onClick={() => { onClose(); onExpand(chart.id); }}
                  style={{
                    width: '100%', padding: '6px 0', borderRadius: 7,
                    border: '1px solid oklch(90% 0.006 263)', background: 'transparent', cursor: 'pointer',
                    color: 'oklch(54% 0.006 263)', fontSize: '0.6875rem', fontWeight: 500,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    transition: 'all 0.13s cubic-bezier(0.23, 1, 0.32, 1)',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = ACCENT; e.currentTarget.style.color = 'white'; e.currentTarget.style.borderColor = ACCENT; e.currentTarget.style.boxShadow = '0 0 14px oklch(37% 0.185 263 / 0.3)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'oklch(54% 0.006 263)'; e.currentTarget.style.borderColor = 'oklch(90% 0.006 263)'; e.currentTarget.style.boxShadow = 'none'; }}
                >
                  Open full chart
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ── Message ────────────────────────────────────────────────────────────────

function Msg({ m, fresh }: { m: Message; fresh: boolean }) {
  const isUser = m.role === 'user';

  if (isUser) {
    return (
      <div style={{
        display: 'flex', justifyContent: 'flex-end',
        ...(fresh ? { animation: 'msg-user-in 0.32s cubic-bezier(0.34, 1.56, 0.64, 1) forwards' } : {}),
      }}>
        <div style={{ maxWidth: '72%', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          <div style={{
            background: 'var(--color-user-bg)', border: '1px solid var(--color-border)',
            borderRadius: '12px 12px 3px 12px', padding: '10px 14px',
            fontSize: '0.9375rem', lineHeight: 1.6, color: 'var(--color-ink)',
            wordBreak: 'break-word', whiteSpace: 'pre-wrap',
          }}>
            {m.text}
          </div>
          <time style={{ fontSize: '0.625rem', color: 'var(--color-ink-4)', paddingRight: 2 }}>
            {clock(m.ts)}
          </time>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: 12 }}>
      <Avatar size={26} />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-ink-2)' }}>Roger</span>
          <time style={{ fontSize: '0.625rem', color: 'var(--color-ink-4)' }}>{clock(m.ts)}</time>
        </div>
        <div style={{
          ...(fresh ? { animation: 'msg-agent-in 0.22s cubic-bezier(0.23, 1, 0.32, 1) forwards' } : {}),
        }}>
          <RichText content={m.text} />
        </div>
      </div>
    </div>
  );
}

// ── Typing ─────────────────────────────────────────────────────────────────

function Typing() {
  return (
    <div style={{ display: 'flex', gap: 12, animation: 'msg-agent-in 0.18s cubic-bezier(0.23, 1, 0.32, 1)' }}>
      <Avatar size={26} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-ink-2)' }}>Roger</span>
        <div style={{ display: 'flex', gap: 5, alignItems: 'center', paddingTop: 2 }}>
          {[0, 0.15, 0.3].map((delay, i) => (
            <span key={i} style={{
              display: 'block', width: 5, height: 5, borderRadius: '50%',
              background: 'var(--color-ink-3)',
              animation: `dot-wave 1.1s ease-in-out ${delay}s infinite`,
            }} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────

function Empty({ onPick }: { onPick: (t: string) => void }) {
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '48px 24px',
    }}>
      {/* Avatar — spring pop, focal point of the boot sequence */}
      <div style={{
        marginBottom: 20,
        animation: `pop-in 0.52s ${EASE_SPRING} 120ms both`,
      }}>
        <Avatar size={44} />
      </div>

      {/* Heading — rises up after avatar settles */}
      <h1 style={{
        margin: '0 0 7px', fontSize: '1.125rem', fontWeight: 600,
        letterSpacing: '-0.02em', color: 'var(--color-ink)',
        textWrap: 'balance', textAlign: 'center',
        animation: `rise-in 0.4s ${EASE_OUT} 210ms both`,
      }}>
        What are you working on?
      </h1>

      {/* Subtitle — follows heading with a short offset */}
      <p style={{
        margin: '0 0 28px', fontSize: '0.875rem', color: 'var(--color-ink-3)', textAlign: 'center',
        animation: `rise-in 0.38s ${EASE_OUT} 270ms both`,
      }}>
        Ask anything, or start with one of these.
      </p>

      {/* Starter buttons — cascade one by one */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 420 }}>
        {STARTERS.map((s, i) => (
          <button
            key={s.label}
            onClick={() => onPick(s.text)}
            style={{
              padding: '7px 14px', borderRadius: 99,
              border: '1px solid var(--color-border)', background: 'var(--color-surface)',
              color: 'var(--color-ink-2)', fontSize: '0.8125rem', fontWeight: 500,
              cursor: 'pointer', transition: `all 0.15s ${EASE_OUT}`,
              animation: `rise-in 0.36s ${EASE_OUT} ${330 + i * 55}ms both`,
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = ACCENT; e.currentTarget.style.color = ACCENT; e.currentTarget.style.background = 'var(--color-accent-m)'; e.currentTarget.style.boxShadow = '0 0 10px oklch(37% 0.185 263 / 0.12)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.color = 'var(--color-ink-2)'; e.currentTarget.style.background = 'var(--color-surface)'; e.currentTarget.style.boxShadow = 'none'; }}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Input bar — liquid glass ───────────────────────────────────────────────

function Input({ value, onChange, onSend, thinking }: {
  value: string; onChange: (v: string) => void; onSend: () => void; thinking: boolean;
}) {
  const ta   = useRef<HTMLTextAreaElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const can  = value.trim().length > 0 && !thinking;

  useEffect(() => {
    const el = ta.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 140) + 'px';
  }, [value]);

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(); }
  };

  const focusGlow  = 'inset 0 1px 0 oklch(100% 0 0 / 0.35), 0 0 0 3px oklch(100% 0 0 / 0.22), 0 4px 24px oklch(0% 0 0 / 0.18)';
  const defaultGlow = 'inset 0 1px 0 oklch(100% 0 0 / 0.3), 0 4px 20px oklch(0% 0 0 / 0.14)';

  return (
    <div style={{ padding: '0 20px 20px' }}>
      <div
        ref={wrap}
        style={{
          maxWidth: 680, margin: '0 auto',
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'oklch(100% 0 0 / 0.13)',
          backdropFilter: 'blur(28px) saturate(180%)',
          WebkitBackdropFilter: 'blur(28px) saturate(180%)',
          border: '1px solid oklch(100% 0 0 / 0.28)',
          boxShadow: defaultGlow,
          borderRadius: 14, padding: '0 10px 0 16px', minHeight: 50,
          transition: 'border-color 0.15s, box-shadow 0.15s',
        }}
        onFocusCapture={() => { if (wrap.current) { wrap.current.style.borderColor = 'oklch(100% 0 0 / 0.55)'; wrap.current.style.boxShadow = focusGlow; } }}
        onBlurCapture ={() => { if (wrap.current) { wrap.current.style.borderColor = 'oklch(100% 0 0 / 0.28)'; wrap.current.style.boxShadow = defaultGlow; } }}
      >
        <textarea
          ref={ta} value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={onKey}
          placeholder="Message Roger…"
          rows={1}
          aria-label="Message"
          className="glass-textarea"
          style={{
            flex: 1, resize: 'none', border: 'none', outline: 'none',
            background: 'transparent', color: 'white',
            caretColor: 'white',
            fontSize: '0.9375rem', lineHeight: 1.55, fontFamily: 'inherit',
            maxHeight: 140, overflowY: 'auto', padding: '13px 0', scrollbarWidth: 'none',
          }}
        />
        <button
          className="send-btn"
          onClick={onSend} disabled={!can} aria-label="Send"
          style={{
            flexShrink: 0, width: 32, height: 32, borderRadius: '50%', border: 'none',
            background: can ? 'white' : 'oklch(100% 0 0 / 0.12)',
            color: can ? ACCENT : 'oklch(100% 0 0 / 0.3)',
            cursor: can ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.15s, box-shadow 0.15s, transform 0.15s cubic-bezier(0.23, 1, 0.32, 1)',
            boxShadow: can ? '0 2px 10px oklch(0% 0 0 / 0.2)' : 'none',
          }}
          onMouseEnter={e => { if (!can) return; e.currentTarget.style.background = 'oklch(96% 0 0)'; e.currentTarget.style.boxShadow = '0 4px 16px oklch(0% 0 0 / 0.25)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = can ? 'white' : 'oklch(100% 0 0 / 0.12)'; e.currentTarget.style.boxShadow = can ? '0 2px 10px oklch(0% 0 0 / 0.2)' : 'none'; }}
        >
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
            <path d="M6.5 11V2M6.5 2L2.5 6M6.5 2L10.5 6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
      <p style={{ margin: '7px 0 0', textAlign: 'center', fontSize: '0.625rem', color: 'oklch(100% 0 0 / 0.4)' }}>
        Return to send · Shift+Return for new line
      </p>
    </div>
  );
}

// ── Chat root ──────────────────────────────────────────────────────────────

export default function Chat() {
  const [msgs, setMsgs]               = useState<Message[]>([]);
  const [input, setInput]             = useState('');
  const [status, setStatus]           = useState<Status>('idle');
  const [typing, setTyping]           = useState(false);
  const [newIds, setNewIds]           = useState<Set<string>>(new Set());
  const [expandedChartId, setExpandedChartId] = useState<string | null>(null);
  const [chartsOpen, setChartsOpen]   = useState(false);
  const [charts, setCharts]           = useState<Record<string, ChartSpec>>({});
  const [chartTimestamps, setChartTimestamps] = useState<Record<string, Date>>({});

  const scrollEl  = useRef<HTMLDivElement>(null);
  const replyIdx  = useRef(0);
  const hasCharts = Object.keys(charts).length > 0;

  const toBottom = useCallback(() => {
    requestAnimationFrame(() => {
      if (scrollEl.current) scrollEl.current.scrollTop = scrollEl.current.scrollHeight;
    });
  }, []);

  useEffect(() => { toBottom(); }, [msgs, typing, toBottom]);

  useEffect(() => {
    const handler = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') { setChartsOpen(false); setExpandedChartId(null); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const send = useCallback(() => {
    const t = input.trim();
    if (!t || status === 'thinking') return;

    const userMsg: Message = { id: String(Date.now()), role: 'user', text: t, ts: new Date() };
    setMsgs(p => [...p, userMsg]);
    setNewIds(p => new Set([...p, userMsg.id]));
    setInput('');
    setStatus('thinking');
    setTyping(true);

    const delay = 900 + Math.random() * 900;
    const triggersChart = isChartQuery(t);

    setTimeout(() => {
      const chartId = triggersChart ? String(Date.now() + 2) : undefined;
      const now = new Date();

      if (triggersChart && chartId) {
        const spec: ChartSpec = { id: chartId, ...QUARTERLY_CHART };
        setCharts(p => ({ ...p, [chartId]: spec }));
        setChartTimestamps(p => ({ ...p, [chartId]: now }));
      }

      const agentMsg: Message = {
        id: String(Date.now() + 1), role: 'agent',
        text: pickReply(t, replyIdx.current++),
        ts: now, chartId,
      };
      setTyping(false);
      setStatus('idle');
      setMsgs(p => [...p, agentMsg]);
      setNewIds(p => new Set([...p, agentMsg.id]));
    }, delay);
  }, [input, status]);

  const expandedChart = expandedChartId ? charts[expandedChartId] : null;

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      <TopBar
        status={status}
        chartCount={Object.keys(charts).length}
        chartsOpen={chartsOpen}
        onNew={() => { setMsgs([]); setStatus('idle'); setTyping(false); setChartsOpen(false); setExpandedChartId(null); }}
        onToggleCharts={() => setChartsOpen(o => !o)}
      />

      {/* Body — scroll area with gradient+input overlay at bottom */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', minHeight: 0 }}>

        {/* Conversation scroll — full height with bottom padding to clear overlay */}
        <div
          ref={scrollEl}
          role="log" aria-live="polite" aria-label="Conversation"
          style={{
            position: 'absolute', inset: 0,
            overflowY: 'auto', scrollBehavior: 'smooth',
            display: 'flex', flexDirection: 'column',
            paddingBottom: BOTTOM_OVERLAY,
          }}
        >
          {msgs.length === 0
            ? <Empty onPick={t => setInput(t)} />
            : (
              <div style={{
                maxWidth: hasCharts ? 1032 : 680,
                width: '100%', margin: '0 auto',
                padding: '28px 20px 0',
                display: 'flex', flexDirection: 'column', gap: 28,
                transition: 'max-width 0.4s cubic-bezier(0.23, 1, 0.32, 1)',
              }}>
                {msgs.map(m => (
                  <div key={m.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 24 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Msg m={m} fresh={newIds.has(m.id)} />
                    </div>
                    {hasCharts && (
                      <div style={{ width: 300, flexShrink: 0 }}>
                        {m.chartId && charts[m.chartId] && (
                          <ChartCard
                            chart={charts[m.chartId]}
                            timestamp={chartTimestamps[m.chartId]}
                            onExpand={() => setExpandedChartId(m.chartId!)}
                          />
                        )}
                      </div>
                    )}
                  </div>
                ))}
                {typing && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 24 }}>
                    <div style={{ flex: 1, minWidth: 0 }}><Typing /></div>
                    {hasCharts && <div style={{ width: 300, flexShrink: 0 }} />}
                  </div>
                )}
              </div>
            )
          }
        </div>

        {/* Gradient overlay — eased multi-stop, transparent → accent */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          background: `linear-gradient(to bottom, ${BOTTOM_GRADIENT})`,
          paddingTop: 110,
          pointerEvents: 'none',
        }}>
          {/* Input re-enables pointer events; boot animation rises from below */}
          <div style={{
            pointerEvents: 'all',
            animation: `rise-in 0.52s ${EASE_OUT} 80ms both`,
          }}>
            <Input value={input} onChange={setInput} onSend={send} thinking={status === 'thinking'} />
          </div>
        </div>

      </div>

      {/* My Charts panel */}
      {chartsOpen && (
        <MyChartsPanel
          charts={charts}
          chartTimestamps={chartTimestamps}
          onClose={() => setChartsOpen(false)}
          onExpand={id => setExpandedChartId(id)}
        />
      )}

      {/* ChartPanel modal */}
      {expandedChart && (
        <div
          onClick={() => setExpandedChartId(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 60,
            background: 'oklch(0% 0 0 / 0.28)',
            backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'fade-in 0.18s ease-out',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: 'min(940px, 92vw)', height: 'min(600px, 88vh)',
              borderRadius: 16, overflow: 'hidden',
              boxShadow: '0 32px 80px oklch(0% 0 0 / 0.22)',
              animation: 'panel-in 0.28s cubic-bezier(0.23, 1, 0.32, 1)',
            }}
          >
            <ChartPanel chart={expandedChart} onClose={() => setExpandedChartId(null)} />
          </div>
        </div>
      )}

    </div>
  );
}
