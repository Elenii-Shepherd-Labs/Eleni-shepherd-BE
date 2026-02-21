import { Message } from '../../llm/dto';
import { Types } from 'mongoose';

export interface ConversationSession {
  sessionId: string;
  userId?: Types.ObjectId | string;
  messages: Message[];
  context: string;
  createdAt: Date;
  lastActivityAt: Date;
  interrupted: boolean;
}
