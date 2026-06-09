'use client';

import { useState, useRef, useEffect, useCallback, KeyboardEvent } from 'react';

// ── Types ──────────────────────────────────────────────────────────────────

type Role   = 'user' | 'agent';
type Status = 'idle' | 'thinking' | 'error';

interface Message {
  id: string;
  role: Role;
  content: string;
  ts: Date;
}

interface Thread {
  id: string;
  title: string;
  date: Date;
  active?: boolean;
}

// ── Fixtures ───────────────────────────────────────────────────────────────

const SEED_MESSAGES: Message[] = [
  { id: '1', role: 'agent', content: 'Hello. What are you working on?',                                          ts: new Date(Date.now() - 6 * 60_000) },
  { id: '2', role: 'user',  content: 'I need to plan a product launch for next quarter.',                       ts: new Date(Date.now() - 5 * 60_000) },
  { id: '3', role: 'agent', content: "Good starting point. What's already decided — date, audience, channels — and what still needs figuring out?", ts: new Date(Date.now() - 4 * 60_000) },
];

const THREADS: Thread[] = [
  { id: 't1', title: 'Product launch planning',  date: new Date(),                            active: true },
  { id: 't2', title: 'Competitive landscape',    date: new Date(Date.now() - 86_400_000)      },
  { id: 't3', title: 'Pricing model review',     date: new Date(Date.now() - 3 * 86_400_000)  },
  { id: 't4', title: 'Onboarding copy pass',     date: new Date(Date.now() - 6 * 86_400_000)  },
];

const REPLIES = [
  "Got it. What's the constraint you're most worried about?",
  "That makes sense. What does the ideal outcome look like?",
  "Useful context. Who else is involved in this decision?",
  "Understood. What have you already tried or ruled out?",
  "Good. What's the timeline, and is it fixed or negotiable?",
  "Worth breaking that into two separate problems. Which one is more urgent?",
];

const PROMPTS = [
  'Help me plan a product launch',
  'Summarize my priorities for this week',
  'Draft talking points for a difficult conversation',
  'Review this strategy and find the gaps',
];

// ── Helpers ────────────────────────────────────────────────────────────────

const fmt = (d: Date) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

function rel(d: Date) {
  const diff = Date.now() - d.getTime();
  if (diff < 86_400_000)     return 'Today';
  if (diff < 2 * 86_400_000) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── Mark ───────────────────────────────────────────────────────────────────

function Mark({ s = 22 }: { s?: number }) {
  return (
    <div aria-hidden="true" style={{
      width: s, height: s, borderRadius: '50%', flexShrink: 0,
      background: 'radial-gradient(circle at 36% 32%, oklch(66% 0.11 246), oklch(40% 0.17 262) 58%, oklch(28% 0.12 278))',
    }} />
  );
}

// ── Sidebar ────────────────────────────────────────────────────────────────

const W0 = 52;
const W1 = 216;

function Sidebar({ open, setOpen, threads, status, onNew, onProfile }: {
  open: boolean; setOpen: (v: boolean) => void;
  threads: Thread[]; status: Status;
  onNew: () => void; onProfile: () => void;
}) {
  const label = (show: boolean): React.CSSProperties => ({
    opacity: show ? 1 : 0,
    transform: show ? 'translateX(0)' : 'translateX(-4px)',
    transition: show
      ? 'opacity 0.15s ease-out 0.06s, transform 0.15s ease-out 0.06s'
      : 'opacity 0.08s ease-out, transform 0.08s ease-out',
    whiteSpace: 'nowrap', overflow: 'hidden',
    pointerEvents: show ? 'auto' : 'none',
  });

  const row = (active?: boolean): React.CSSProperties => ({
    width: '100%', display: 'flex', alignItems: 'center', gap: 9,
    padding: '6px 8px', borderRadius: 7, border: 'none',
    background: active ? 'var(--color-accent-muted)' : 'transparent',
    cursor: 'pointer', transition: 'background 0.12s', textAlign: 'left',
  });

  return (
    <aside
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      style={{
        position: 'absolute', inset: '0 auto 0 0',
        width: open ? W1 : W0, zIndex: 20,
        transition: 'width 0.22s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        background: 'var(--color-sidebar)',
        borderRight: '1px solid var(--color-border-subtle)',
        boxShadow: open ? '4px 0 20px oklch(0% 0 0 / 0.045)' : 'none',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}
    >
      <div style={{ width: W1, display: 'flex', flexDirection: 'column', height: '100%' }}>

        {/* Logo row */}
        <div style={{ height: 50, display: 'flex', alignItems: 'center', padding: '0 13px', gap: 10, flexShrink: 0 }}>
          <Mark s={22} />
          <span style={{ ...label(open), fontSize: '0.875rem', fontWeight: 550, letterSpacing: '-0.016em', color: 'var(--color-ink)' }}>
            Triplette
          </span>
          <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', ...label(open) }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              fontSize: '0.625rem', color: 'var(--color-ink-4)',
            }}>
              <span style={{
                width: 5, height: 5, borderRadius: '50%',
                background: status === 'idle' ? 'var(--color-online)' : status === 'thinking' ? 'var(--color-thinking)' : 'var(--color-error)',
                animation: status === 'thinking' ? 'dot-pulse 1.4s ease-in-out infinite' : 'none',
              }} />
              {status === 'idle' ? 'online' : status}
            </span>
          </div>
        </div>

        {/* New thread */}
        <div style={{ padding: '2px 8px 8px' }}>
          <button
            onClick={onNew} aria-label="New conversation"
            style={row(false)}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-border-subtle)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >
            <span style={{
              width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, color: 'var(--color-ink-3)',
            }}>
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
                <path d="M6.5 1.5v10M1.5 6.5h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </span>
            <span style={{ ...label(open), fontSize: '0.8125rem', color: 'var(--color-ink-3)' }}>New conversation</span>
          </button>
        </div>

        <div style={{ height: 1, background: 'var(--color-border-subtle)', margin: '0 12px 6px' }} />

        <div style={{ padding: '3px 16px 3px', ...label(open) }}>
          <span style={{ fontSize: '0.5625rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'var(--color-ink-4)' }}>
            Recent
          </span>
        </div>

        {/* Thread list */}
        <nav aria-label="Conversations" style={{ flex: 1, overflowY: 'auto', padding: '2px 8px' }}>
          {threads.map(t => (
            <button
              key={t.id} aria-current={t.active ? 'page' : undefined}
              style={row(t.active)}
              onMouseEnter={e => { if (!t.active) e.currentTarget.style.background = 'var(--color-border-subtle)'; }}
              onMouseLeave={e => { if (!t.active) e.currentTarget.style.background = 'transparent'; }}
            >
              <span style={{
                width: 4, height: 4, borderRadius: '50%', flexShrink: 0, marginLeft: 3,
                background: t.active ? 'var(--color-accent)' : 'var(--color-ink-4)',
              }} />
              <span style={{ ...label(open), flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 6 }}>
                <span style={{
                  fontSize: '0.8125rem', fontWeight: t.active ? 500 : 400,
                  color: t.active ? 'var(--color-ink)' : 'var(--color-ink-2)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
                }}>
                  {t.title}
                </span>
                <span style={{ fontSize: '0.5625rem', color: 'var(--color-ink-4)', flexShrink: 0 }}>{rel(t.date)}</span>
              </span>
            </button>
          ))}
        </nav>

        <div style={{ height: 1, background: 'var(--color-border-subtle)', margin: '4px 12px' }} />

        {/* Profile */}
        <div style={{ padding: '6px 8px 10px' }}>
          <button
            onClick={onProfile} aria-label="Open profile"
            style={row(false)}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-border-subtle)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <span style={{
              width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
              background: 'var(--color-accent)', color: 'white',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.6875rem', fontWeight: 600, userSelect: 'none',
            }}>G</span>
            <span style={{ ...label(open), display: 'flex', flexDirection: 'column', gap: 1 }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--color-ink)', lineHeight: 1.2 }}>Gaulthier</span>
              <span style={{ fontSize: '0.5625rem', color: 'var(--color-ink-4)', lineHeight: 1 }}>Profile & settings</span>
            </span>
          </button>
        </div>

      </div>
    </aside>
  );
}

// ── Message ────────────────────────────────────────────────────────────────

function Msg({ m, fresh }: { m: Message; fresh: boolean }) {
  const u = m.role === 'user';
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: u ? 'flex-end' : 'flex-start',
      ...(fresh ? { animation: 'msg-in 0.18s ease-out forwards' } : {}),
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4,
        flexDirection: u ? 'row-reverse' : 'row',
      }}>
        <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--color-ink-2)' }}>
          {u ? 'You' : 'Triplette'}
        </span>
        <time dateTime={m.ts.toISOString()} style={{ fontSize: '0.625rem', color: 'var(--color-ink-4)' }}>
          {fmt(m.ts)}
        </time>
      </div>
      <div style={{
        maxWidth: '80%',
        background: u ? 'var(--color-user-bg)' : 'transparent',
        borderRadius: 11, padding: u ? '9px 13px' : 0,
        fontSize: '0.9375rem', lineHeight: 1.65,
        color: 'var(--color-ink)', wordBreak: 'break-word',
      }}>
        {m.content}
      </div>
    </div>
  );
}

// ── Thinking dots ──────────────────────────────────────────────────────────

function Thinking() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', animation: 'msg-in 0.16s ease-out' }}>
      <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--color-ink-2)', marginBottom: 8 }}>Triplette</span>
      <div style={{ display: 'flex', gap: 4 }}>
        {[0, 0.14, 0.28].map((d, i) => (
          <span key={i} style={{
            display: 'block', width: 5, height: 5, borderRadius: '50%',
            background: 'var(--color-ink-4)',
            animation: `dot-pulse 1.4s ease-in-out ${d}s infinite`,
          }} />
        ))}
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
      padding: '48px 24px', gap: 32,
      animation: 'fade-in 0.24s ease-out',
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          <Mark s={38} />
        </div>
        <h1 style={{
          margin: '0 0 7px', fontSize: '1.1875rem', fontWeight: 550,
          letterSpacing: '-0.02em', color: 'var(--color-ink)', textWrap: 'balance',
        }}>
          What are you working on?
        </h1>
        <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--color-ink-3)', lineHeight: 1.6 }}>
          Ask anything, or start with one of these.
        </p>
      </div>

      <ul role="list" style={{
        listStyle: 'none', margin: 0, padding: 0,
        display: 'flex', flexDirection: 'column', gap: 5,
        width: '100%', maxWidth: 380,
      }}>
        {PROMPTS.map((p, i) => (
          <li key={i}>
            <button
              onClick={() => onPick(p)}
              style={{
                width: '100%', textAlign: 'left', padding: '10px 13px', borderRadius: 8,
                border: '1px solid var(--color-border)', background: 'var(--color-surface)',
                color: 'var(--color-ink-2)', fontSize: '0.875rem', lineHeight: 1.5, cursor: 'pointer',
                transition: 'border-color 0.13s, color 0.13s, background 0.13s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'var(--color-ink-3)';
                e.currentTarget.style.color = 'var(--color-ink)';
                e.currentTarget.style.background = 'var(--color-raised)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'var(--color-border)';
                e.currentTarget.style.color = 'var(--color-ink-2)';
                e.currentTarget.style.background = 'var(--color-surface)';
              }}
            >
              {p}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Input ──────────────────────────────────────────────────────────────────

function Input({ value, onChange, onSend, disabled }: {
  value: string; onChange: (v: string) => void;
  onSend: () => void; disabled?: boolean;
}) {
  const ta   = useRef<HTMLTextAreaElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const can  = value.trim().length > 0 && !disabled;

  useEffect(() => {
    const el = ta.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 136) + 'px';
  }, [value]);

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(); }
  };

  return (
    <div style={{
      padding: '10px 24px 18px',
      borderTop: '1px solid var(--color-border-subtle)',
      background: 'oklch(99.5% 0 0 / 0.9)',
      backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)',
    }}>
      <div
        ref={wrap}
        style={{
          maxWidth: 660, margin: '0 auto',
          display: 'flex', alignItems: 'flex-end', gap: 8,
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 13, padding: '9px 9px 9px 15px',
          boxShadow: '0 1px 4px oklch(0% 0 0 / 0.04)',
          transition: 'border-color 0.13s, box-shadow 0.13s',
        }}
        onFocusCapture={() => {
          if (wrap.current) {
            wrap.current.style.borderColor = 'var(--color-ink-3)';
            wrap.current.style.boxShadow = '0 0 0 3px oklch(0% 0 0 / 0.04)';
          }
        }}
        onBlurCapture={() => {
          if (wrap.current) {
            wrap.current.style.borderColor = 'var(--color-border)';
            wrap.current.style.boxShadow = '0 1px 4px oklch(0% 0 0 / 0.04)';
          }
        }}
      >
        <textarea
          ref={ta} value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={onKey}
          placeholder="Message Triplette…" rows={1} aria-label="Message"
          style={{
            flex: 1, resize: 'none', border: 'none', outline: 'none',
            background: 'transparent', color: 'var(--color-ink)',
            fontSize: '0.9375rem', lineHeight: 1.55, fontFamily: 'inherit',
            maxHeight: 136, overflowY: 'auto', padding: 0,
          }}
        />
        <button
          onClick={onSend} disabled={!can} aria-label="Send"
          style={{
            flexShrink: 0, width: 31, height: 31, borderRadius: '50%', border: 'none',
            background: can ? 'var(--color-accent)' : 'var(--color-border)',
            color: can ? 'white' : 'var(--color-ink-4)',
            cursor: can ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.13s, transform 0.1s',
          }}
          onMouseEnter={e => { if (can) e.currentTarget.style.transform = 'scale(1.08)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
        >
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
            <path d="M6.5 11V2M6.5 2L2.5 6M6.5 2L10.5 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
      <p style={{ margin: '5px 0 0', textAlign: 'center', fontSize: '0.625rem', color: 'var(--color-ink-4)' }}>
        Return to send · Shift+Return for new line
      </p>
    </div>
  );
}

// ── Chat ───────────────────────────────────────────────────────────────────

export default function Chat() {
  const [msgs, setMsgs]     = useState<Message[]>(SEED_MESSAGES);
  const [input, setInput]   = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [typing, setTyping] = useState(false);
  const [open, setOpen]     = useState(false);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());

  const scrollEl = useRef<HTMLDivElement>(null);
  const ri       = useRef(0);

  const toBottom = useCallback(() => {
    requestAnimationFrame(() => {
      if (scrollEl.current) scrollEl.current.scrollTop = scrollEl.current.scrollHeight;
    });
  }, []);

  useEffect(() => { toBottom(); }, [msgs, typing, toBottom]);

  const send = useCallback(() => {
    const t = input.trim();
    if (!t || status === 'thinking') return;

    const u: Message = { id: String(Date.now()), role: 'user', content: t, ts: new Date() };
    setMsgs(p => [...p, u]);
    setNewIds(p => new Set([...p, u.id]));
    setInput('');
    setStatus('thinking');
    setTyping(true);

    setTimeout(() => {
      const a: Message = {
        id: String(Date.now() + 1), role: 'agent',
        content: REPLIES[ri.current % REPLIES.length],
        ts: new Date(),
      };
      ri.current++;
      setTyping(false);
      setStatus('idle');
      setMsgs(p => [...p, a]);
      setNewIds(p => new Set([...p, a.id]));
    }, 1100 + Math.random() * 700);
  }, [input, status]);

  return (
    <div style={{ height: '100dvh', display: 'flex', overflow: 'hidden', position: 'relative' }}>

      {/* Collapsed sidebar placeholder */}
      <div style={{ width: W0, flexShrink: 0 }} aria-hidden="true" />

      <Sidebar
        open={open} setOpen={setOpen}
        threads={THREADS} status={status}
        onNew={() => setMsgs([])}
        onProfile={() => {}}
      />

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        <div
          ref={scrollEl}
          role="log" aria-live="polite" aria-label="Conversation"
          style={{ flex: 1, overflowY: 'auto', scrollBehavior: 'smooth' }}
        >
          {msgs.length === 0
            ? <Empty onPick={setInput} />
            : (
              <div style={{
                maxWidth: 660, margin: '0 auto',
                padding: '36px 24px 16px',
                display: 'flex', flexDirection: 'column', gap: 24,
              }}>
                {msgs.map(m => <Msg key={m.id} m={m} fresh={newIds.has(m.id)} />)}
                {typing && <Thinking />}
              </div>
            )
          }
        </div>

        <Input value={input} onChange={setInput} onSend={send} disabled={status === 'thinking'} />
      </main>
    </div>
  );
}
