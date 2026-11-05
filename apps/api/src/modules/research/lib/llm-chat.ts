import { type LLMConfig, type DeepSeekResponse } from '../types.js';

export async function llmChat(
  config: LLMConfig,
  systemPrompt: string,
  userContent: object,
): Promise<DeepSeekResponse> {
  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...config,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: JSON.stringify(userContent),
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(
      `DeepSeek API error ${response.status}: ${await response.text()}`,
    );
  }

  return (await response.json()) as DeepSeekResponse;
}
