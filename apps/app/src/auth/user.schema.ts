import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

/** Subscription tiers: free = English only, subscribed = all languages */
export type SubscriptionTier = 'free' | 'subscribed';

@Schema({ _id: false })
export class FullName {
  @Prop()
  firstname?: string;

  @Prop()
  lastname?: string;
}

@Schema({ timestamps: true })
export class User extends Document {
  @Prop({ required: true })
  username: string;

  @Prop({ type: FullName })
  fullname?: FullName;

  @Prop({ required: true })
  email: string;

  @Prop({ required: true })
  googleId: string;

  /** free = English only; subscribed = English, Hausa, Yoruba, Igbo, Swahili, German, etc. */
  @Prop({ type: String, enum: ['free', 'subscribed'], default: 'free' })
  subscriptionTier: SubscriptionTier;
}

export const UserSchema = SchemaFactory.createForClass(User);
