import { Types } from 'mongoose';

/**
 * Conversational AI Session Entity
 * Represents a conversation session with context
 */
export class ConversationSessionEntity {
  id: string;
  // reference to User._id
  userId?: Types.ObjectId | string;
  messages: ConversationMessageEntity[];
  context?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Conversation Message Entity
 * Represents a single message in a conversation
 */
export class ConversationMessageEntity {
  id: string;
  sessionId: string;
  userMessage: string;
  assistantResponse?: string;
  context?: string;
  timestamp: Date;
}
