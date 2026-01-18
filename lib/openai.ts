import OpenAI from 'openai';

let openaiClient: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (openaiClient) {
    return openaiClient;
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('OpenAI API key must be set');
  }

  openaiClient = new OpenAI({
    apiKey: apiKey,
  });

  return openaiClient;
}

export async function getEmbedding(text: string): Promise<number[]> {
  const client = getOpenAIClient();
  
  const response = await client.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
    // Using default 1536 dimensions for maximum accuracy
  });

  return response.data[0].embedding;
}

export async function chatCompletion(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  context?: string,
  options?: { temperature?: number; preserveSystemMessage?: boolean }
) {
  const client = getOpenAIClient();

  // Check if a system message is already in the messages array
  const hasSystemMessage = messages.some(msg => msg.role === 'system');
  
  const systemMessage = hasSystemMessage && options?.preserveSystemMessage
    ? undefined // Don't add default system message if one is provided and we want to preserve it
    : context
    ? `You are an intelligent advisor for telephony systems and projects. Use the following context from the knowledge base to answer questions accurately and helpfully:\n\n${context}\n\nIf the context doesn't contain relevant information, use your general knowledge but indicate when you're doing so.\n\nIMPORTANT: Write in a natural, conversational tone. Do not use markdown formatting like ### headers, **bold**, *italic*, code blocks, or bullet points. Write as if you're speaking directly to the user in plain, human-friendly text.`
    : 'You are an intelligent advisor for telephony systems and projects. Provide helpful, accurate information about telephony systems, project management, and related content updates.\n\nIMPORTANT: Write in a natural, conversational tone. Do not use markdown formatting like ### headers, **bold**, *italic*, code blocks, or bullet points. Write as if you\'re speaking directly to the user in plain, human-friendly text.';

  const allMessages = systemMessage 
    ? [{ role: 'system' as const, content: systemMessage }, ...messages]
    : messages;

  const model = process.env.OPENAI_MODEL || 'gpt-5.2';
  
  const completionParams: any = {
    model: model,
    messages: allMessages,
    temperature: options?.temperature ?? 0.7,
  };

  // Use max_completion_tokens for GPT-5 models, max_tokens for others
  if (model.startsWith('gpt-5')) {
    completionParams.max_completion_tokens = 4000;
  } else {
    completionParams.max_tokens = 4000;
  }

  const response = await client.chat.completions.create(completionParams);

  return response.choices[0]?.message?.content || '';
}

