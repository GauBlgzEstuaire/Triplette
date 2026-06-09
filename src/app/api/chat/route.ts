import Groq from 'groq-sdk';

const client = new Groq({ apiKey: process.env.GROQ_API_KEY });

const SYSTEM = `You are Roger, a strategic AI assistant built by Estuaire. You help business teams analyze data, plan strategy, and make sharp decisions.

You have access to a show_chart tool. Use it whenever the user asks for a chart, graph, or data visualization — or whenever you have quantitative data that is clearer as a visual. Call the tool first, then provide your written analysis below it.

Format every response using this syntax:
- **bold** for key figures, names, and emphasis
- ### Heading  for section titles
- - item  for bullet lists
- [info] text  for neutral context or clarifications
- [success] text  for positive signals or achievements
- [warning] text  for risks, caveats, or things to investigate

Rules:
- Be direct. No filler openers like "Great question" or "Certainly".
- Lead with the most important thing.
- When listing, bold the label: **Label:** description.
- You are talking to senior business professionals. Match their level.`;

const CHART_TOOL: Groq.Chat.Completions.ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'show_chart',
    description: 'Display a bar chart for quantitative data. Call this whenever the user asks for a chart or when data is clearer visually.',
    parameters: {
      type: 'object' as const,
      properties: {
        title: { type: 'string', description: 'Chart title' },
        unit:  { type: 'string', description: 'Unit label shown on the Y-axis (e.g. "kg/person/year", "€M", "%", "users")' },
        data: {
          type: 'array',
          description: 'Data points — at least 2, max 12',
          items: {
            type: 'object',
            properties: {
              label: { type: 'string', description: 'X-axis label (e.g. country name, quarter, month)' },
              value: { type: 'number', description: 'Numeric value' },
            },
            required: ['label', 'value'],
          },
        },
      },
      required: ['title', 'data'],
    },
  },
};

type ApiMessage = { role: string; content: string };

function buildMessages(messages: ApiMessage[]) {
  return messages.map(m => ({
    role: m.role === 'agent' ? 'assistant' as const : 'user' as const,
    content: m.content,
  }));
}

export async function POST(req: Request) {
  const { messages } = await req.json() as { messages: ApiMessage[] };
  const builtMsgs = buildMessages(messages);

  // First call — non-streaming, checks whether the model wants to use the chart tool
  const first = await client.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    max_tokens: 1024,
    messages: [{ role: 'system', content: SYSTEM }, ...builtMsgs],
    tools: [CHART_TOOL],
    tool_choice: 'auto',
  });

  const assistantMsg = first.choices[0].message;
  const toolCall = assistantMsg.tool_calls?.[0];

  // Helper: stream a completion into a ReadableStream, optionally prefixed
  async function streamToResponse(
    prefix: string,
    extraMessages: Groq.Chat.Completions.ChatCompletionMessageParam[],
  ) {
    const stream = await client.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 1024,
      stream: true,
      messages: [{ role: 'system', content: SYSTEM }, ...builtMsgs, ...extraMessages],
    });

    const readable = new ReadableStream({
      async start(controller) {
        if (prefix) controller.enqueue(new TextEncoder().encode(prefix));
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

  if (toolCall?.function.name === 'show_chart') {
    let chartData: unknown;
    try { chartData = JSON.parse(toolCall.function.arguments); }
    catch { chartData = null; }

    const prefix = chartData ? `CHART:${JSON.stringify(chartData)}\n` : '';

    return streamToResponse(prefix, [
      assistantMsg,
      {
        role: 'tool',
        tool_call_id: toolCall.id,
        content: 'Chart rendered successfully.',
      },
    ]);
  }

  // No tool call — if the model already wrote text in the first call, stream it directly
  const directText = assistantMsg.content;
  if (directText) {
    const readable = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(directText));
        controller.close();
      },
    });
    return new Response(readable, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  // Fallback: re-request as streaming
  return streamToResponse('', []);
}
