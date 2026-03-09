import Anthropic from '@anthropic-ai/sdk';

export function createAnthropicClient(apiKey: string): Anthropic {
  return new Anthropic({ apiKey });
}

/**
 * Send a single Anthropic messages request and return the text.
 * Throws if the API returns no text content.
 */
export async function complete(
  client: Anthropic,
  model: string,
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  const response = await client.messages.create({
    model,
    max_tokens: 4096,
    temperature: 0.4,
    temperature: 0.4,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('')
    .trim();
  if (!text) {
    throw new Error('Claude returned an empty response.');
  }
  return text;
}
