import { Controller, Get, Req } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { SubscriptionService } from './subscription.service';
import { LANGUAGE_NAMES } from './subscription.constants';

@ApiTags('Subscription & Languages')
@Controller('subscription')
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Get('allowed-languages')
  @ApiOperation({
    summary: 'Get allowed languages for user tier',
    description: `
Returns languages available based on subscription tier.
- **Free tier**: English only
- **Subscribed**: English, Hausa, Yoruba, Igbo, Swahili, German, Arabic, French, Spanish, Portuguese

**Frontend Implementation**:
\`\`\`typescript
const response = await fetch('http://localhost:3000/subscription/allowed-languages', {
  credentials: 'include', // Include session for authenticated user
});
const result = await response.json();
// result.data = { tier, languages, languageNames }
\`\`\`

Use this to enable/disable language options in TTS, STT, and conversational AI.
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'Allowed languages',
    schema: {
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            tier: { type: 'string', enum: ['free', 'subscribed'] },
            languages: { type: 'array', items: { type: 'string' } },
            languageNames: { type: 'object' },
          },
        },
      },
    },
  })
  async getAllowedLanguages(@Req() req: any) {
    let tier: 'free' | 'subscribed' = 'free';
    const userId = req.user?.id || req.user?._id?.toString?.();
    if (userId) {
      tier = await this.subscriptionService.getUserTier(userId);
    }
    const languages = this.subscriptionService.getAllowedLanguages(userId, tier);
    const languageNames = languages.reduce((acc, code) => {
      acc[code] = LANGUAGE_NAMES[code] || code;
      return acc;
    }, {} as Record<string, string>);

    return {
      success: true,
      message: 'Allowed languages retrieved',
      data: { tier, languages, languageNames },
      status: 200,
    };
  }
}
