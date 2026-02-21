/**
 * LLM Message Entity
 * Represents a message in an LLM conversation
 */
export class LlmMessageEntity {
  id: string;
  sessionId?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  context?: string;
  temperature?: number;
  maxTokens?: number;
  model?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * LLM Session Entity
 * Represents a conversation session with the LLM
 */
export class LlmSessionEntity {
  id: string;
  // reference to User._id
  userId?: import('mongoose').Types.ObjectId | string;
  messages: LlmMessageEntity[];
  model: string;
  createdAt: Date;
  updatedAt: Date;
}
