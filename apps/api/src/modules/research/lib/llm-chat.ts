import { type LLMConfig, type DeepSeekResponse } from '../types.js';

/**
 * A single chat call never gets more than this.
 *
 * Without it a stalled connection hangs the request forever: stage 02 triages
 * pages one after another, so one silent socket freezes the whole run and the
 * job stays RUNNING with no progress. 90 s is well above the slowest normal
 * flash answer and well below a user's patience.
 */
const REQUEST_TIMEOUT_MS = 90_000;

export async function llmChat(
  config: LLMConfig,
  systemPrompt: string,
  userContent: object,
): Promise<DeepSeekResponse> {
  try {
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
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(
        `DeepSeek API error ${response.status}: ${await response.text()}`,
      );
    }

    return (await response.json()) as DeepSeekResponse;
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name === 'TimeoutError' || error.name === 'AbortError')
    ) {
      throw new Error(
        `DeepSeek request timed out after ${REQUEST_TIMEOUT_MS / 1000}s`,
      );
    }

    throw error;
  }
}
