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

// ── Dummy conversation data ────────────────────────────────────────────────
// Each entry is a [user prompt, agent reply] pair. Typing one of the prompts
// (or clicking a starter) cycles through these in order.

const EXCHANGES: [string, string][] = [
  [
    'Help me plan a product launch',
    "Good starting point. Before diving into tactics, I need to understand three things: Who is the launch for — existing users, a new segment, or both? What does success look like in 30 days? And what's the one thing competitors are not doing that you could own?\n\nStart with whichever one you have the clearest answer to.",
  ],
  [
    'Review this strategy and find the gaps',
    "I can do that. Share the document or describe the strategy in your own words — whatever is faster.\n\nWhile you do that, tell me: what has already been challenged internally? I want to know which assumptions the team is confident about versus which ones are still open questions.",
  ],
  [
    'Help me prepare for a difficult conversation',
    "Let's make this concrete. Who is the conversation with, and what outcome do you need from it?\n\nThen tell me: what do you think the other person wants? That gap — between what you need and what they want — is where most difficult conversations break down.",
  ],
  [
    "Summarize my week and prioritize what's left",
    "Walk me through the week — what shipped, what got stuck, and what you didn't get to. Don't filter, just list it.\n\nOnce I have the full picture I'll help you sort what actually needs to happen before Friday versus what can move.",
  ],
  [
    "What's the most important thing I should focus on today?",
    "That depends on one thing: what does a good day look like for you at 6pm?\n\nNot the whole list — just the one thing that would make you feel like today was worth it. Tell me that, and we'll work backwards to make sure it happens.",
  ],
  [
    'Can you help me write a job description?',
    "Yes. Tell me about the role — not the formal requirements, but the problem this person is being hired to solve.\n\nAlso: what does the first 90 days look like for someone who's doing this job well? Good job descriptions describe outcomes, not just responsibilities.",
  ],
  [
    'I have a board meeting next week',
    "Let's get you ready. Three questions:\n\nWhat do they most need to understand that they currently don't? What's the one decision you need from them? And what are you most worried they'll push back on?\n\nBoard prep is mostly about anticipating the hard questions before they ask them.",
  ],
  [
    'We need to cut costs but I don\'t know where to start',
    "Start by separating two lists: costs that are tied to revenue — if you cut them, revenue drops — and costs that aren't.\n\nMost companies overpay on the second list and underpay on the first. What does your spend look like at a high level? Give me the big buckets and I'll help you figure out which ones to look at first.",
  ],
];

// Standalone short replies used when the user types something off-script
const FALLBACK_REPLIES = [
  "That's a useful frame. What's the most important constraint you're working within?",
  "Understood. Walk me through what you've already tried or ruled out.",
  "Good. Who else is involved in this decision, and where do they stand?",
  "Worth separating the immediate problem from the underlying need. Which one are we solving first?",
  "Makes sense. What does success look like in 30 days?",
  "I want to make sure I understand the stakes. What happens if nothing changes?",
];

const STARTERS = [
  { label: 'Plan',      text: 'Help me plan a product launch' },
  { label: 'Review',    text: 'Review this strategy and find the gaps' },
  { label: 'Prepare',   text: 'Help me prepare for a difficult conversation' },
  { label: 'Prioritize', text: "Summarize my week and prioritize what's left" },
];

// ── Helpers ────────────────────────────────────────────────────────────────

const clock = (d: Date) =>
  d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

function pickReply(text: string, index: number): string {
  const match = EXCHANGES.find(([prompt]) =>
    prompt.toLowerCase().trim() === text.toLowerCase().trim()
  );
  if (match) return match[1];
  return FALLBACK_REPLIES[index % FALLBACK_REPLIES.length];
}

// ── Avatar ─────────────────────────────────────────────────────────────────

const AVATAR_BG =
  'radial-gradient(circle at 38% 34%, oklch(55% 0.16 248), oklch(37% 0.19 263) 55%, oklch(24% 0.14 278))';

function Avatar({ size = 26 }: { size?: number }) {
  return (
    <div
      aria-hidden="true"
      style={{
        width: size, height: size, borderRadius: '50%', flexShrink: 0,
        background: AVATAR_BG,
        boxShadow: '0 0 0 1px oklch(37% 0.185 263 / 0.2)',
      }}
    />
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
      background: 'var(--color-raised)', border: '1px solid var(--color-border)',
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
          cursor: 'pointer',
          transition: 'background 0.15s, color 0.15s, border-color 0.15s',
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
        ...(fresh ? {
          animation: 'msg-user-in 0.32s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        } : {}),
      }}>
        <div style={{ maxWidth: '72%', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          <div style={{
            background: 'var(--color-user-bg)',
            border: '1px solid var(--color-border)',
            borderRadius: '12px 12px 3px 12px',
            padding: '10px 14px',
            fontSize: '0.9375rem', lineHeight: 1.6,
            color: 'var(--color-ink)', wordBreak: 'break-word',
            whiteSpace: 'pre-wrap',
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
        {/* Only the text animates — avatar and name mount instantly so they don't flash */}
        <p style={{
          margin: 0, fontSize: '0.9375rem', lineHeight: 1.65,
          color: 'var(--color-ink)', wordBreak: 'break-word',
          whiteSpace: 'pre-wrap',
          ...(fresh ? { animation: 'msg-agent-in 0.22s cubic-bezier(0.23, 1, 0.32, 1) forwards' } : {}),
        }}>
          {m.text}
        </p>
      </div>
    </div>
  );
}

// ── Typing indicator ───────────────────────────────────────────────────────

function Typing() {
  return (
    <div style={{ display: 'flex', gap: 12, animation: 'msg-agent-in 0.18s cubic-bezier(0.23, 1, 0.32, 1)' }}>
      <Avatar size={26} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-ink-2)' }}>Roger</span>
        {/* Wave dots — each one staggered 150ms */}
        <div style={{ display: 'flex', gap: 5, alignItems: 'center', paddingTop: 2 }}>
          {[0, 0.15, 0.3].map((delay, i) => (
            <span
              key={i}
              style={{
                display: 'block', width: 5, height: 5, borderRadius: '50%',
                background: 'var(--color-ink-3)',
                animation: `dot-wave 1.1s ease-in-out ${delay}s infinite`,
              }}
            />
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
      animation: 'fade-in 0.3s cubic-bezier(0.23, 1, 0.32, 1)',
    }}>
      <div style={{ marginBottom: 20 }}>
        <Avatar size={44} />
      </div>

      <h1 style={{
        margin: '0 0 7px', fontSize: '1.125rem', fontWeight: 600,
        letterSpacing: '-0.02em', color: 'var(--color-ink)',
        textWrap: 'balance', textAlign: 'center',
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
        {STARTERS.map((s, i) => (
          <button
            key={s.label}
            onClick={() => onPick(s.text)}
            style={{
              padding: '7px 14px', borderRadius: 99,
              border: '1px solid var(--color-border)',
              background: 'var(--color-surface)',
              color: 'var(--color-ink-2)', fontSize: '0.8125rem', fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.15s cubic-bezier(0.23, 1, 0.32, 1)',
              /* Stagger the chips in */
              animation: `fade-in 0.3s cubic-bezier(0.23, 1, 0.32, 1) ${i * 50}ms both`,
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

// ── Input bar ──────────────────────────────────────────────────────────────

function Input({ value, onChange, onSend, thinking }: {
  value: string; onChange: (v: string) => void;
  onSend: () => void; thinking: boolean;
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
          className="send-btn"
          onClick={onSend} disabled={!can} aria-label="Send"
          style={{
            flexShrink: 0, width: 32, height: 32, borderRadius: '50%', border: 'none',
            background: can ? 'var(--color-accent)' : 'var(--color-raised)',
            color: can ? 'white' : 'var(--color-ink-4)',
            cursor: can ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.15s, box-shadow 0.15s, transform 0.15s cubic-bezier(0.23, 1, 0.32, 1)',
            boxShadow: can ? 'var(--glow-accent)' : 'none',
          }}
          onMouseEnter={e => {
            if (!can) return;
            e.currentTarget.style.background = 'var(--color-accent-h)';
            e.currentTarget.style.boxShadow = 'var(--glow-accent-h)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = can ? 'var(--color-accent)' : 'var(--color-raised)';
            e.currentTarget.style.boxShadow = can ? 'var(--glow-accent)' : 'none';
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

// ── Chat root ──────────────────────────────────────────────────────────────

export default function Chat() {
  const [msgs, setMsgs]     = useState<Message[]>([]);
  const [input, setInput]   = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [typing, setTyping] = useState(false);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());

  const scrollEl  = useRef<HTMLDivElement>(null);
  const replyIdx  = useRef(0);

  const toBottom = useCallback(() => {
    requestAnimationFrame(() => {
      if (scrollEl.current) scrollEl.current.scrollTop = scrollEl.current.scrollHeight;
    });
  }, []);

  useEffect(() => { toBottom(); }, [msgs, typing, toBottom]);

  const send = useCallback(() => {
    const t = input.trim();
    if (!t || status === 'thinking') return;

    const userMsg: Message = { id: String(Date.now()), role: 'user', text: t, ts: new Date() };
    setMsgs(p => [...p, userMsg]);
    setNewIds(p => new Set([...p, userMsg.id]));
    setInput('');
    setStatus('thinking');
    setTyping(true);

    // Vary delay slightly so it feels real (not perfectly timed)
    const delay = 900 + Math.random() * 900;

    setTimeout(() => {
      const reply = pickReply(t, replyIdx.current++);
      const agentMsg: Message = { id: String(Date.now() + 1), role: 'agent', text: reply, ts: new Date() };
      setTyping(false);
      setStatus('idle');
      setMsgs(p => [...p, agentMsg]);
      setNewIds(p => new Set([...p, agentMsg.id]));
    }, delay);
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
          ? <Empty onPick={t => setInput(t)} />
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
