import { Message } from '../../llm/dto';

export interface ConversationSession {
  sessionId: string;
  userId?: string; // Optional: link to your existing User model
  messages: Message[];
  context: string;
  createdAt: Date;
  lastActivityAt: Date;
  interrupted: boolean;
}
