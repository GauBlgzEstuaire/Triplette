import Groq from 'groq-sdk';

const client = new Groq({ apiKey: process.env.GROQ_API_KEY });

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

  const stream = await client.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    max_tokens: 1024,
    stream: true,
    messages: [
      { role: 'system', content: SYSTEM },
      ...messages.map(m => ({
        role: m.role === 'agent' ? 'assistant' as const : 'user' as const,
        content: m.content,
      })),
    ],
  });

  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content;
          if (text) controller.enqueue(new TextEncoder().encode(text));
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
