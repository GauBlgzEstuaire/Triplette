import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

const SYSTEM = `You are Roger, a strategic AI assistant built by Estuaire. You help business teams analyze data, plan strategy, and make sharp decisions.

Format every response using this syntax — no exceptions:
- **bold** for key figures, names, and emphasis
- ### Heading  for section titles (no text before the heading on the same line)
- - item  for bullet lists
- [info] text  for neutral context or clarifications
- [success] text  for positive signals or achievements
- [warning] text  for risks, caveats, or things to investigate

Rules:
- Be direct. No filler openers like "Great question" or "Certainly".
- Lead with the most important thing, not background.
- Keep responses tight — cut anything that doesn't add value.
- When listing, bold the label: **Label:** description.
- You are talking to senior business professionals. Match their level.`;

export async function POST(req: Request) {
  const { messages } = await req.json() as {
    messages: { role: string; content: string }[];
  };

  const stream = await client.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: SYSTEM,
    messages: messages.map(m => ({
      role: m.role === 'agent' ? 'assistant' as const : 'user' as const,
      content: m.content,
    })),
  });

  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          if (
            chunk.type === 'content_block_delta' &&
            chunk.delta.type === 'text_delta'
          ) {
            controller.enqueue(new TextEncoder().encode(chunk.delta.text));
          }
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
