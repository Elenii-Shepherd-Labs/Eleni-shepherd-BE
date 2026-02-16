/**
 * User Onboarding Entity
 * Represents a user's onboarding progress and information
 */
export class OnboardingEntity {
  id: string;
  // reference to User._id
  userId: import('mongoose').Types.ObjectId | string;
  firstname?: string;
  lastname?: string;
  audioFile?: string;
  audioTranscription?: string;
  completedSteps: string[];
  createdAt: Date;
  updatedAt: Date;
}
