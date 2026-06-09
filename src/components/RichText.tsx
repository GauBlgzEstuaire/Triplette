'use client';

import React from 'react';

// ── Inline parser ──────────────────────────────────────────────────────────
// Handles **bold** — emojis pass through naturally as unicode

function parseInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const re = /\*\*(.+?)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push(
      <strong key={m.index} style={{ fontWeight: 650, color: 'oklch(12% 0.004 263)' }}>
        {m[1]}
      </strong>
    );
    last = re.lastIndex;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

// Detects **Label:** value pattern — returns label and rest separately
function parseListItem(text: string): { label: string | null; rest: string } {
  const m = /^\*\*(.+?:)\*\*\s*(.*)$/.exec(text);
  return m ? { label: m[1], rest: m[2] } : { label: null, rest: text };
}

// ── Block types ────────────────────────────────────────────────────────────

type CalloutVariant = 'info' | 'success' | 'warning';

type Block =
  | { type: 'p';       text: string }
  | { type: 'h3';      text: string }
  | { type: 'callout'; variant: CalloutVariant; text: string }
  | { type: 'list';    items: string[] };

function parseBlocks(content: string): Block[] {
  const lines = content.split('\n');
  const blocks: Block[] = [];
  let list: string[] | null = null;

  const flushList = () => {
    if (list) { blocks.push({ type: 'list', items: list }); list = null; }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (line.startsWith('### ')) {
      flushList();
      blocks.push({ type: 'h3', text: line.slice(4) });
    } else if (line.startsWith('[info] ')) {
      flushList();
      blocks.push({ type: 'callout', variant: 'info', text: line.slice(7) });
    } else if (line.startsWith('[success] ')) {
      flushList();
      blocks.push({ type: 'callout', variant: 'success', text: line.slice(10) });
    } else if (line.startsWith('[warning] ')) {
      flushList();
      blocks.push({ type: 'callout', variant: 'warning', text: line.slice(10) });
    } else if (line.startsWith('- ')) {
      if (!list) list = [];
      list.push(line.slice(2));
    } else if (line === '') {
      flushList();
    } else {
      flushList();
      blocks.push({ type: 'p', text: line });
    }
  }
  flushList();
  return blocks.filter(b => b.type !== 'p' || (b as { type: 'p'; text: string }).text.trim() !== '');
}

// ── Callout styles ─────────────────────────────────────────────────────────

const CALLOUT: Record<CalloutVariant, { bg: string; border: string; color: string; dot: string }> = {
  info: {
    bg:     'oklch(96% 0.018 263)',
    border: '1px solid oklch(87% 0.04 263)',
    color:  'oklch(32% 0.12 263)',
    dot:    'oklch(45% 0.15 263)',
  },
  success: {
    bg:     'oklch(96% 0.025 155)',
    border: '1px solid oklch(87% 0.05 155)',
    color:  'oklch(32% 0.12 155)',
    dot:    'oklch(46% 0.14 155)',
  },
  warning: {
    bg:     'oklch(97% 0.03 75)',
    border: '1px solid oklch(88% 0.07 75)',
    color:  'oklch(38% 0.12 75)',
    dot:    'oklch(52% 0.14 75)',
  },
};

const CALLOUT_ICON: Record<CalloutVariant, string> = {
  info:    'ℹ',
  success: '✓',
  warning: '⚠',
};

// ── RichText ───────────────────────────────────────────────────────────────

export default function RichText({ content }: { content: string }) {
  const blocks = parseBlocks(content);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {blocks.map((block, i) => {
        if (block.type === 'h3') {
          return (
            <p key={i} style={{
              margin: i > 0 ? '4px 0 0' : 0,
              fontSize: '0.8125rem', fontWeight: 650,
              letterSpacing: '-0.01em', color: 'oklch(12% 0.004 263)',
            }}>
              {parseInline(block.text)}
            </p>
          );
        }

        if (block.type === 'callout') {
          const s = CALLOUT[block.variant];
          return (
            <div key={i} style={{
              display: 'flex', alignItems: 'flex-start', gap: 9,
              background: s.bg, border: s.border,
              borderRadius: 9, padding: '9px 12px',
              fontSize: '0.8125rem', lineHeight: 1.55, color: s.color,
            }}>
              <span style={{
                flexShrink: 0, width: 16, height: 16, borderRadius: '50%',
                background: s.dot, color: 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.5rem', fontWeight: 700, marginTop: 1,
              }}>
                {CALLOUT_ICON[block.variant]}
              </span>
              <span>{parseInline(block.text)}</span>
            </div>
          );
        }

        if (block.type === 'list') {
          return (
            <ul key={i} style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 5 }}>
              {block.items.map((item, j) => {
                const { label, rest } = parseListItem(item);
                return (
                  <li key={j} style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
                    <span style={{
                      flexShrink: 0, width: 4, height: 4, borderRadius: '50%',
                      background: 'oklch(45% 0.15 263)', marginTop: 9,
                    }} />
                    <span style={{ fontSize: '0.875rem', color: 'oklch(30% 0.006 263)', lineHeight: 1.6 }}>
                      {label && (
                        <span style={{ color: 'oklch(37% 0.185 263)', fontWeight: 600 }}>
                          {label}{' '}
                        </span>
                      )}
                      {parseInline(rest)}
                    </span>
                  </li>
                );
              })}
            </ul>
          );
        }

        // paragraph
        return (
          <p key={i} style={{ margin: 0, fontSize: '0.875rem', color: 'oklch(20% 0.006 263)', lineHeight: 1.65 }}>
            {parseInline(block.text)}
          </p>
        );
      })}
    </div>
  );
}
