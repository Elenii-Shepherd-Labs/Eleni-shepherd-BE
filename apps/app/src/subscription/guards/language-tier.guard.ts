import {
  CanActivate,
  ExecutionContext,
  Injectable,
  BadRequestException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SubscriptionService } from '../subscription.service';
export const LANGUAGE_PARAM = 'language';

/**
 * Guard that validates the requested language is allowed for the user's subscription tier.
 * Attach to endpoints that accept a language parameter (e.g., TTS, STT).
 * User must be authenticated; optional for endpoints that work without auth (default to free tier).
 */
@Injectable()
export class LanguageTierGuard implements CanActivate {
  constructor(
    private readonly subscriptionService: SubscriptionService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const language = request.body?.language || request.query?.language;

    if (!language) return true; // No language specified - will use default

    let tier: 'free' | 'subscribed' = 'free';
    let userId: string | undefined;

    if (request.user?.id) {
      userId = request.user.id;
      tier = await this.subscriptionService.getUserTier(userId);
    }

    const allowed = this.subscriptionService.isLanguageAllowed(
      language,
      userId,
      tier,
    );

    if (!allowed) {
      throw new BadRequestException(
        `Language "${language}" is not available on the free tier. Subscribe to access Hausa, Yoruba, Igbo, Swahili, German, and more.`,
      );
    }

    request._languageTier = tier;
    request._allowedLanguages = this.subscriptionService.getAllowedLanguages(
      userId,
      tier,
    );
    return true;
  }
}
