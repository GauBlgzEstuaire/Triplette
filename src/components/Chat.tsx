'use client';

import { useState, useRef, useEffect, useCallback, KeyboardEvent } from 'react';

// ── Types ──────────────────────────────────────────────────────────────────

type Role   = 'user' | 'agent';
type Status = 'idle' | 'thinking' | 'error';

interface Message {
  id: string;
  role: Role;
  text: string;
  ts: Date;
}

// ── Fixtures ───────────────────────────────────────────────────────────────

const REPLIES = [
  "Got it. What's the constraint you're most worried about?",
  "That makes sense. Walk me through the current state first.",
  "Useful. Who else is involved in this decision?",
  "Understood. What have you already tried or ruled out?",
  "Good. What does success look like, and by when?",
  "Worth separating the immediate problem from the underlying need. Which one are we solving?",
];

const STARTERS = [
  { label: 'Plan',      text: 'Help me plan a product launch' },
  { label: 'Review',    text: 'Review this strategy and find the gaps' },
  { label: 'Prepare',   text: 'Help me prepare for a difficult conversation' },
  { label: 'Summarize', text: "Summarize my week and prioritize what's left" },
];

// ── Helpers ────────────────────────────────────────────────────────────────

const clock = (d: Date) =>
  d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

// ── Avatar ─────────────────────────────────────────────────────────────────

const AVATAR_BG = 'radial-gradient(circle at 38% 34%, oklch(55% 0.16 248), oklch(37% 0.19 263) 55%, oklch(24% 0.14 278))';

function Avatar({ size = 26 }: { size?: number }) {
  return (
    <div aria-hidden="true" style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: AVATAR_BG,
      boxShadow: '0 0 0 1px oklch(37% 0.185 263 / 0.2)',
    }} />
  );
}

// ── Status pill ────────────────────────────────────────────────────────────

function StatusPill({ status }: { status: Status }) {
  const dot = status === 'idle' ? 'var(--color-green)' : status === 'thinking' ? 'var(--color-amber)' : 'var(--color-red)';
  const label = status === 'idle' ? 'Online' : status === 'thinking' ? 'Thinking' : 'Error';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 9px', borderRadius: 99,
      background: 'var(--color-raised)',
      border: '1px solid var(--color-border)',
      fontSize: '0.6875rem', fontWeight: 500, color: 'var(--color-ink-3)',
      letterSpacing: '0.01em',
    }}>
      <span style={{
        width: 5, height: 5, borderRadius: '50%', background: dot, flexShrink: 0,
        boxShadow: status === 'idle' ? '0 0 5px var(--color-green)' : 'none',
      }} />
      {label}
    </span>
  );
}

// ── Top bar ────────────────────────────────────────────────────────────────

function TopBar({ status, onNew }: { status: Status; onNew: () => void }) {
  return (
    <header style={{
      height: 52, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 20px',
      borderBottom: '1px solid var(--color-border-s)',
      background: 'var(--color-bg)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Avatar size={22} />
        <span style={{
          fontSize: '0.9375rem', fontWeight: 600,
          letterSpacing: '-0.018em', color: 'var(--color-ink)',
        }}>
          Roger
        </span>
        <StatusPill status={status} />
      </div>

      <button
        onClick={onNew}
        aria-label="New conversation"
        style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '5px 11px', borderRadius: 7,
          border: '1px solid var(--color-border)',
          background: 'transparent',
          color: 'var(--color-ink-3)', fontSize: '0.75rem', fontWeight: 500,
          cursor: 'pointer', transition: 'all 0.13s',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = 'var(--color-raised)';
          e.currentTarget.style.color = 'var(--color-ink)';
          e.currentTarget.style.borderColor = 'var(--color-ink-4)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.color = 'var(--color-ink-3)';
          e.currentTarget.style.borderColor = 'var(--color-border)';
        }}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
          <path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        New
      </button>
    </header>
  );
}

// ── Message ────────────────────────────────────────────────────────────────

function Msg({ m, fresh }: { m: Message; fresh: boolean }) {
  const isUser = m.role === 'user';

  if (isUser) {
    return (
      <div style={{
        display: 'flex', justifyContent: 'flex-end',
        ...(fresh ? { animation: 'msg-in 0.18s ease-out forwards' } : {}),
      }}>
        <div style={{ maxWidth: '72%', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          <div style={{
            background: 'var(--color-user-bg)',
            border: '1px solid var(--color-border)',
            borderRadius: '12px 12px 3px 12px',
            padding: '10px 14px',
            fontSize: '0.9375rem', lineHeight: 1.6,
            color: 'var(--color-ink)', wordBreak: 'break-word',
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
    <div style={{
      display: 'flex', gap: 12,
      ...(fresh ? { animation: 'msg-in 0.18s ease-out forwards' } : {}),
    }}>
      <Avatar size={26} />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-ink-2)' }}>Roger</span>
          <time style={{ fontSize: '0.625rem', color: 'var(--color-ink-4)' }}>{clock(m.ts)}</time>
        </div>
        <p style={{ margin: 0, fontSize: '0.9375rem', lineHeight: 1.65, color: 'var(--color-ink)', wordBreak: 'break-word' }}>
          {m.text}
        </p>
      </div>
    </div>
  );
}

// ── Typing ─────────────────────────────────────────────────────────────────

function Typing() {
  return (
    <div style={{ display: 'flex', gap: 12, animation: 'msg-in 0.16s ease-out' }}>
      <Avatar size={26} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-ink-2)' }}>Roger</span>
        <div style={{ display: 'flex', gap: 4, paddingTop: 5 }}>
          {[0, 0.16, 0.32].map((d, i) => (
            <span key={i} style={{
              display: 'block', width: 5, height: 5, borderRadius: '50%',
              background: 'var(--color-ink-4)',
              animation: `blink 1.2s ease-in-out ${d}s infinite`,
            }} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Empty ──────────────────────────────────────────────────────────────────

function Empty({ onPick }: { onPick: (t: string) => void }) {
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '48px 24px',
      animation: 'fade-in 0.24s ease-out',
    }}>
      <div style={{ marginBottom: 20 }}>
        <Avatar size={44} />
      </div>

      <h1 style={{
        margin: '0 0 7px', fontSize: '1.125rem', fontWeight: 600,
        letterSpacing: '-0.02em', color: 'var(--color-ink)', textWrap: 'balance',
        textAlign: 'center',
      }}>
        What are you working on?
      </h1>
      <p style={{
        margin: '0 0 28px', fontSize: '0.875rem',
        color: 'var(--color-ink-3)', textAlign: 'center',
      }}>
        Ask anything, or start with one of these.
      </p>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 380 }}>
        {STARTERS.map(s => (
          <button
            key={s.label}
            onClick={() => onPick(s.text)}
            style={{
              padding: '7px 14px', borderRadius: 99,
              border: '1px solid var(--color-border)',
              background: 'var(--color-surface)',
              color: 'var(--color-ink-2)', fontSize: '0.8125rem', fontWeight: 500,
              cursor: 'pointer', transition: 'all 0.13s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'var(--color-accent)';
              e.currentTarget.style.color = 'var(--color-accent)';
              e.currentTarget.style.background = 'var(--color-accent-m)';
              e.currentTarget.style.boxShadow = '0 0 10px oklch(37% 0.185 263 / 0.12)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'var(--color-border)';
              e.currentTarget.style.color = 'var(--color-ink-2)';
              e.currentTarget.style.background = 'var(--color-surface)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Input ──────────────────────────────────────────────────────────────────

function Input({ value, onChange, onSend, thinking }: {
  value: string; onChange: (v: string) => void;
  onSend: () => void; thinking: boolean;
}) {
  const ta   = useRef<HTMLTextAreaElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const btn  = useRef<HTMLButtonElement>(null);
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

  return (
    <div style={{
      padding: '12px 20px 20px',
      borderTop: '1px solid var(--color-border-s)',
      background: 'oklch(100% 0 0 / 0.92)',
      backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)',
    }}>
      <div
        ref={wrap}
        style={{
          maxWidth: 680, margin: '0 auto',
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 14, padding: '0 10px 0 16px',
          minHeight: 50,
          transition: 'border-color 0.15s, box-shadow 0.15s',
        }}
        onFocusCapture={() => {
          if (wrap.current) {
            wrap.current.style.borderColor = 'var(--color-accent)';
            wrap.current.style.boxShadow = 'var(--glow-focus)';
          }
        }}
        onBlurCapture={() => {
          if (wrap.current) {
            wrap.current.style.borderColor = 'var(--color-border)';
            wrap.current.style.boxShadow = 'none';
          }
        }}
      >
        <textarea
          ref={ta} value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={onKey}
          placeholder="Message Roger…" rows={1} aria-label="Message"
          style={{
            flex: 1, resize: 'none', border: 'none', outline: 'none',
            background: 'transparent', color: 'var(--color-ink)',
            fontSize: '0.9375rem', lineHeight: 1.55, fontFamily: 'inherit',
            maxHeight: 140, overflowY: 'auto', padding: '13px 0',
            scrollbarWidth: 'none',
          }}
        />
        <button
          ref={btn}
          onClick={onSend} disabled={!can} aria-label="Send"
          style={{
            flexShrink: 0, width: 32, height: 32, borderRadius: '50%', border: 'none',
            background: can ? 'var(--color-accent)' : 'var(--color-raised)',
            color: can ? 'white' : 'var(--color-ink-4)',
            cursor: can ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.15s, box-shadow 0.15s, transform 0.1s',
            boxShadow: can ? 'var(--glow-accent)' : 'none',
          }}
          onMouseEnter={e => {
            if (!can) return;
            e.currentTarget.style.background = 'var(--color-accent-h)';
            e.currentTarget.style.boxShadow = 'var(--glow-accent-h)';
            e.currentTarget.style.transform = 'scale(1.06)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = can ? 'var(--color-accent)' : 'var(--color-raised)';
            e.currentTarget.style.boxShadow = can ? 'var(--glow-accent)' : 'none';
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
            <path d="M6.5 11V2M6.5 2L2.5 6M6.5 2L10.5 6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
      <p style={{ margin: '6px 0 0', textAlign: 'center', fontSize: '0.625rem', color: 'var(--color-ink-4)' }}>
        Return to send · Shift+Return for new line
      </p>
    </div>
  );
}

// ── Chat ───────────────────────────────────────────────────────────────────

export default function Chat() {
  const [msgs, setMsgs]     = useState<Message[]>([]);
  const [input, setInput]   = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [typing, setTyping] = useState(false);
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

    const u: Message = { id: String(Date.now()), role: 'user', text: t, ts: new Date() };
    setMsgs(p => [...p, u]);
    setNewIds(p => new Set([...p, u.id]));
    setInput('');
    setStatus('thinking');
    setTyping(true);

    setTimeout(() => {
      const a: Message = {
        id: String(Date.now() + 1), role: 'agent',
        text: REPLIES[ri.current % REPLIES.length],
        ts: new Date(),
      };
      ri.current++;
      setTyping(false);
      setStatus('idle');
      setMsgs(p => [...p, a]);
      setNewIds(p => new Set([...p, a.id]));
    }, 1000 + Math.random() * 800);
  }, [input, status]);

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      <TopBar status={status} onNew={() => { setMsgs([]); setStatus('idle'); setTyping(false); }} />

      <div
        ref={scrollEl}
        role="log" aria-live="polite" aria-label="Conversation"
        style={{ flex: 1, overflowY: 'auto', scrollBehavior: 'smooth', display: 'flex', flexDirection: 'column' }}
      >
        {msgs.length === 0
          ? <Empty onPick={t => { setInput(t); }} />
          : (
            <div style={{
              maxWidth: 680, width: '100%', margin: '0 auto',
              padding: '28px 20px 16px',
              display: 'flex', flexDirection: 'column', gap: 28,
            }}>
              {msgs.map(m => <Msg key={m.id} m={m} fresh={newIds.has(m.id)} />)}
              {typing && <Typing />}
            </div>
          )
        }
      </div>

      <Input value={input} onChange={setInput} onSend={send} thinking={status === 'thinking'} />
    </div>
  );
}
