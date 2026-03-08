import Anthropic from '@anthropic-ai/sdk';

export function createOpenAIClient(apiKey: string): Anthropic {
  return new Anthropic({ apiKey });
}

/**
 * Send a single chat-completion request and return the text.
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

  const content = response.content[0];
  if (!content || content.type !== 'text') {
    throw new Error('Claude returned an empty response.');
  }
  return content.text.trim();
}
