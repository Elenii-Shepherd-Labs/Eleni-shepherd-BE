/**
 * User Entity - API response shape for user data
 * Used for consistent serialization and Swagger documentation
 */
export class UserEntity {
  id: string;
  username: string;
  email: string;
  fullname?: {
    firstname?: string;
    lastname?: string;
  };
  subscriptionTier?: 'free' | 'subscribed';
  createdAt?: Date;
  updatedAt?: Date;
}
