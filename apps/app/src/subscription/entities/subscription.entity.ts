/**
 * Subscription Entity - represents user subscription state
 */
export class SubscriptionEntity {
  userId: string;
  tier: 'free' | 'subscribed';
  allowedLanguages: string[];
  expiresAt?: Date;
}
