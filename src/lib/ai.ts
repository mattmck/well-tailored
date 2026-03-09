import Anthropic from '@anthropic-ai/sdk';

export function createAnthropicClient(apiKey: string): Anthropic {
  return new Anthropic({ apiKey });
}

/**
 * Send a single Messages API request and return the text.
 * Throws if the API returns no content.
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
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const textBlocks = response.content.filter(
    (block): block is Anthropic.TextBlock => block.type === 'text',
  );
  if (textBlocks.length === 0) {
    throw new Error('Claude returned an empty response.');
  }
  return textBlocks.map(block => block.text).join('').trim();
}
