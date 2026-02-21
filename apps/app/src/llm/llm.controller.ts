import { Controller, Post, Body, Res } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
} from '@nestjs/swagger';
import { LlmService } from './llm.service';
import { Response } from 'express';
import { GenerateResponseDto } from './dto';

@ApiTags('LLM')
@Controller('llm')
export class LlmController {
  constructor(private readonly llmService: LlmService) {}

  @Post('generate')
  @ApiOperation({
    summary: 'Generate LLM response',
    description: `
Send messages to the LLM (OpenAI or Anthropic) and receive an AI-generated response.

**Supported Backends**: OpenAI (GPT-3.5/4), Anthropic (Claude)

**Frontend Implementation**:
\`\`\`typescript
const response = await fetch('http://localhost:3000/llm/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    messages: [
      {
        role: 'user',
        content: 'What is the capital of France?',
      },
    ],
    context: 'Geography quiz',
    temperature: 0.7,
    maxTokens: 500,
  }),
  credentials: 'include',
});

const result = await response.json();
console.log('AI Response:', result.data.response);
\`\`\`

**Message Format**:
The \`messages\` array follows the OpenAI chat format:
\`\`\`typescript
{
  role: 'user' | 'assistant' | 'system',
  content: string
}
\`\`\`

**Parameters**:
- \`messages\` (required): Array of message objects with role and content
- \`context\` (optional): Domain/system context for the LLM
- \`temperature\` (optional): Creativity level (0-2). Default: 0.7
  - 0 = Deterministic
  - 1 = Balanced
  - 2 = Very creative
- \`maxTokens\` (optional): Maximum response length. Default: 500

**Use Cases**:
- Ask general knowledge questions
- Get personalized responses with context
- Multi-turn conversation (use conversational-ai for session management)
- Content generation
- Code assistance
- Translation and summarization

**Important**:
For multi-turn conversations, use /conversational-ai endpoints which handle session state.
This endpoint is for single-turn requests or manual state management.

**Limits**:
- Context length depends on model (typically 2K-4K tokens)
- Response time: 1-5 seconds typically
- Token limits enforced per request
    `,
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
      example3: {
        value: {
          messages: [
            {
              role: 'system',
              content: 'You are a helpful JavaScript expert.',
            },
            {
              role: 'user',
              content: 'How do I reverse an array in JavaScript?',
            },
          ],
          temperature: 0.3,
          maxTokens: 300,
        },
        description: 'With system prompt',
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Response generated successfully',
    schema: {
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string' },
        data: {
          type: 'object',
          properties: {
            response: {
              type: 'string',
              description: 'The LLM-generated response',
              example: 'The capital of France is Paris.',
            },
            provider: {
              type: 'string',
              enum: ['openai', 'anthropic', 'mock'],
              description: 'The LLM provider used',
              example: 'openai',
            },
            tokensUsed: {
              type: 'number',
              description: 'Total tokens consumed',
              example: 45,
            },
          },
        },
        status: { type: 'number', example: 200 },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request (no messages, invalid model, etc.)',
    schema: {
      properties: {
        success: { type: 'boolean', example: false },
        message: {
          type: 'string',
          example: 'Invalid request or no API keys configured',
        },
        data: { type: 'null' },
        status: { type: 'number', example: 400 },
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: 'Server error or API provider error',
  })
  async generateResponse(@Body() generateResponseDto: GenerateResponseDto, @Res() res: Response) {
    const resp = await this.llmService.generateResponse(
      generateResponseDto.messages,
      generateResponseDto.context,
    );
    return res.status(resp.status || 200).json(resp);
  }

  @Post('generate/stream')
  @ApiOperation({
    summary: 'Generate streaming LLM response',
    description: `
Get streamed token-by-token response from the LLM using Server-Sent Events (SSE).

**Status**: Currently a demonstration endpoint. Full streaming coming in next release.

**Frontend Implementation (Future)**:
\`\`\`typescript
const eventSource = new EventSource(
  'http://localhost:3000/llm/generate/stream?' +
  new URLSearchParams({
    prompt: 'Tell me a story',
  })
);

eventSource.onmessage = (event) => {
  console.log('Chunk:', event.data);
};

eventSource.onerror = () => {
  eventSource.close();
};
\`\`\`

**Advantages of Streaming**:
- Real-time token updates
- Better UX (show response as it arrives)
- Lower perceived latency
- Reduced memory for large responses
- Better for chat interfaces

**WebSocket Alternative**:
For bidirectional real-time communication, use Conversational AI WebSocket gateway.

**Coming Soon**:
- True streaming with SSE
- Token-by-token updates
- Cancellation support
- Progress tracking
    `,
  })
  @ApiBody({
    type: GenerateResponseDto,
    description: 'Messages and configuration for LLM',
  })
  @ApiResponse({
    status: 200,
    description: 'Streaming started',
    schema: {
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Streaming endpoint for future WebSocket integration' },
        data: {
          type: 'object',
          properties: {
            note: { type: 'string', description: 'Status/feature information' },
          },
        },
      },
    },
  })
  async generateStreamingResponse(
    @Body() generateResponseDto: GenerateResponseDto,
    @Res() res: Response,
  ) {
    // This endpoint demonstrates the capability for future WebSocket integration
    const resp = await this.llmService.generateResponse(
      generateResponseDto.messages,
      generateResponseDto.context,
    );
    return res.status(resp.status || 200).json({ ...resp, message: 'Streaming endpoint for future WebSocket integration' });
  }
}
