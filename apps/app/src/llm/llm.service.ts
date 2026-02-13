import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { Message } from './dto';

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private openai: OpenAI | null = null;
  private anthropic: Anthropic | null = null;
  private provider: 'openai' | 'anthropic';

  constructor(private readonly configService: ConfigService) {
    const openaiKey = this.configService.get<string>('OPENAI_API_KEY');
    const anthropicKey = this.configService.get<string>('ANTHROPIC_API_KEY');

    if (openaiKey) {
      this.openai = new OpenAI({ apiKey: openaiKey });
      this.provider = 'openai';
      this.logger.log('Initialized OpenAI provider');
    } else if (anthropicKey) {
      this.anthropic = new Anthropic({ apiKey: anthropicKey });
      this.provider = 'anthropic';
      this.logger.log('Initialized Anthropic provider');
    } else {
      this.logger.warn('No API keys provided. Using mock responses.');
    }
  }

  async generateResponse(messages: Message[], context?: string): Promise<string> {
    try {
      const systemPrompt = this.buildSystemPrompt(context);

      if (this.provider === 'openai' && this.openai) {
        return await this.generateOpenAIResponse(messages, systemPrompt);
      } else if (this.provider === 'anthropic' && this.anthropic) {
        return await this.generateAnthropicResponse(messages, systemPrompt);
      } else {
        return this.generateMockResponse(messages);
      }
    } catch (error) {
      this.logger.error(`Error generating response: ${error.message}`);
      throw error;
    }
  }

  private buildSystemPrompt(context?: string): string {
    let prompt = `You are a helpful AI assistant integrated with a screen reader. Your responses should be:
- Clear and concise
- Naturally spoken (optimized for text-to-speech)
- Accessible and easy to understand
- Avoid using formatting like bullet points or markdown
- Speak in complete sentences`;

    if (context) {
      prompt += `\n\nCurrent context: ${context}`;
    }

    return prompt;
  }

  private async generateOpenAIResponse(
    messages: Message[],
    systemPrompt: string,
  ): Promise<string> {
    const completion = await this.openai!.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    return completion.choices[0]?.message?.content || 'I apologize, but I could not generate a response.';
  }

  private async generateAnthropicResponse(
    messages: Message[],
    systemPrompt: string,
  ): Promise<string> {
    const response = await this.anthropic!.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 500,
      system: systemPrompt,
      messages: messages
        .filter((msg) => msg.role !== 'system')
        .map((msg) => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        })),
    });

    const content = response.content[0];
    
    if (content.type === 'text') {
      return content.text;
    }

    return 'I apologize, but I could not generate a response.';
  }

  private generateMockResponse(messages: Message[]): string {
    const lastMessage = messages[messages.length - 1];
    
    return `I received your message: "${lastMessage.content}". This is a mock response because no API keys are configured. Please set OPENAI_API_KEY or ANTHROPIC_API_KEY environment variable.`;
  }

  /**
   * Generate a streaming response (for future use)
   */
  async *generateStreamingResponse(
    messages: Message[],
    context?: string,
  ): AsyncGenerator<string> {
    const systemPrompt = this.buildSystemPrompt(context);

    if (this.provider === 'openai' && this.openai) {
      const stream = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages.map((msg) => ({
            role: msg.role,
            content: msg.content,
          })),
        ],
        stream: true,
        temperature: 0.7,
        max_tokens: 500,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          yield content;
        }
      }
    } else {
      // Fallback to non-streaming
      const response = await this.generateResponse(messages, context);
      yield response;
    }
  }
}
