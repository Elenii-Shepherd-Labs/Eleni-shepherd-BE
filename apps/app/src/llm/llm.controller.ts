import { Controller, Post, Body } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
} from '@nestjs/swagger';
import { LlmService } from './llm.service';
import { GenerateResponseDto } from './dto/message.dto';

@ApiTags('LLM')
@Controller('llm')
export class LlmController {
  constructor(private readonly llmService: LlmService) {}

  @Post('generate')
  @ApiOperation({
    summary: 'Generate LLM response',
    description:
      'Send messages to the LLM and receive an AI-generated response. Supports OpenAI or Anthropic backends.',
  })
  @ApiBody({
    type: GenerateResponseDto,
    description: 'Messages and configuration for LLM',
    examples: {
      example1: {
        value: {
          messages: [
            {
              role: 'user',
              content: 'What is the capital of France?',
            },
          ],
          context: 'Geography quiz',
          temperature: 0.7,
          maxTokens: 500,
        },
        description: 'Simple question with context',
      },
      example2: {
        value: {
          messages: [
            {
              role: 'user',
              content: 'Hello',
            },
            {
              role: 'assistant',
              content: 'Hi! How can I help you today?',
            },
            {
              role: 'user',
              content: 'Tell me a joke',
            },
          ],
          temperature: 0.8,
          maxTokens: 200,
        },
        description: 'Multi-turn conversation',
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Response generated successfully',
    schema: {
      properties: {
        response: {
          type: 'string',
          description: 'The LLM-generated response',
        },
        provider: {
          type: 'string',
          enum: ['openai', 'anthropic', 'mock'],
          description: 'The LLM provider used',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request or no API keys configured',
  })
  async generateResponse(@Body() generateResponseDto: GenerateResponseDto) {
    const response = await this.llmService.generateResponse(
      generateResponseDto.messages,
      generateResponseDto.context,
    );
    return {
      response,
      provider: 'openai', // or 'anthropic' based on configuration
    };
  }

  @Post('generate/stream')
  @ApiOperation({
    summary: 'Generate streaming LLM response',
    description:
      'Get streamed token-by-token response from the LLM (Server-Sent Events).',
  })
  @ApiBody({
    type: GenerateResponseDto,
    description: 'Messages and configuration for LLM',
  })
  @ApiResponse({
    status: 200,
    description: 'Streaming started',
  })
  async generateStreamingResponse(
    @Body() generateResponseDto: GenerateResponseDto,
  ) {
    // This endpoint demonstrates the capability for future WebSocket integration
    const response = await this.llmService.generateResponse(
      generateResponseDto.messages,
      generateResponseDto.context,
    );
    return {
      response,
      provider: 'openai',
      message: 'Streaming endpoint for future WebSocket integration',
    };
  }
}
