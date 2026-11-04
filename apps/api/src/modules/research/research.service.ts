import { Injectable, Logger } from '@nestjs/common';

import type { CreateResearchDto } from './dto/create-research.dto.js';

type DeepSeekResponse = {
  choices: {
    message: {
      content: string;
    };
  }[];
};

@Injectable()
export class ResearchService {
  private readonly logger = new Logger(ResearchService.name);

  async start(dto: CreateResearchDto): Promise<{ status: 'completed' }> {
    this.logger.log(
      `Research started for product "${dto.name}" in ${dto.country}: ${dto.description || '(no description)'}`,
    );
    this.logger.log(
      `DeepSeek API key loaded: ${Boolean(process.env.DEEPSEEK_API_KEY)}`,
    );

    // LLM stage 1
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek-flash',
        thinking: { type: 'disabled' },
        messages: [
          {
            role: 'system',
            content:
              'You prepare product profiles for market research. ' +
              'Briefly explain what the product is, its main applications, ' +
              'and which attributes distinguish it from similar products. ' +
              'Identify important missing details rather than inventing them. ' +
              'Write in English.',
          },
          {
            role: 'user',
            content: JSON.stringify(dto),
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(
        `DeepSeek API error ${response.status}: ${await response.text()}`,
      );
    }

    const data = (await response.json()) as DeepSeekResponse;
    const profile = data.choices[0].message.content;

    if (!profile) {
      throw new Error('DeepSeek returned no product profile');
    }

    this.logger.log(`Product profile:\n${profile}`);

    ////////////////////////////////////////////////

    return { status: 'completed' };
  }
}
