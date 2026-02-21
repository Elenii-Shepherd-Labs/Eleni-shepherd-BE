import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from '../auth/user.schema';
import {
  FREE_TIER_LANGUAGES,
  SUBSCRIBED_TIER_LANGUAGES,
} from './subscription.constants';

@Injectable()
export class SubscriptionService {
  constructor(@InjectModel(User.name) private userModel: Model<User>) {}

  /**
   * Get allowed languages for a user based on their subscription tier.
   * Free: English only. Subscribed: all supported languages.
   */
  getAllowedLanguages(userId?: string, tier?: 'free' | 'subscribed'): string[] {
    if (tier === 'subscribed') {
      return [...SUBSCRIBED_TIER_LANGUAGES];
    }
    return [...FREE_TIER_LANGUAGES];
  }

  /**
   * Check if a language is allowed for the user
   */
  isLanguageAllowed(
    language: string,
    userId?: string,
    tier?: 'free' | 'subscribed',
  ): boolean {
    const allowed = this.getAllowedLanguages(userId, tier);
    return allowed.includes(language?.toLowerCase());
  }

  async getUserTier(userId?: string): Promise<'free' | 'subscribed'> {
    if (!userId) return 'free';
    const user = await this.userModel.findById(userId).select('subscriptionTier').lean();
    return (user?.subscriptionTier as 'free' | 'subscribed') || 'free';
  }
}
