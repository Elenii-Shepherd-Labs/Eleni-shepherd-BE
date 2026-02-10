import { Injectable, Logger } from '@nestjs/common';
import { LlmService } from '../llm/llm.service';
import { Message } from '../llm/dto/message.dto';
import { ConversationSession } from './interfaces/conversation-session.interface';

@Injectable()
export class ConversationService {
  private readonly logger = new Logger(ConversationService.name);
  private sessions: Map<string, ConversationSession> = new Map();

  constructor(private readonly llmService: LlmService) {}

  async initializeSession(sessionId: string, userId?: string): Promise<ConversationSession> {
    const session: ConversationSession = {
      sessionId,
      userId,
      messages: [],
      context: '',
      createdAt: new Date(),
      lastActivityAt: new Date(),
      interrupted: false,
    };

    this.sessions.set(sessionId, session);
    this.logger.log(`Session initialized: ${sessionId}${userId ? ` for user ${userId}` : ''}`);
    
    return session;
  }

  async getSession(sessionId: string): Promise<ConversationSession | undefined> {
    return this.sessions.get(sessionId);
  }

  async addContext(sessionId: string, context: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    session.context = context;
    session.lastActivityAt = new Date();
    
    this.logger.log(`Context added to session ${sessionId}: ${context.substring(0, 100)}...`);
  }

  async processMessage(sessionId: string, userMessage: string): Promise<string> {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // Add user message
    const userMsg: Message = {
      role: 'user',
      content: userMessage,
    };
    session.messages.push(userMsg);

    session.lastActivityAt = new Date();
    session.interrupted = false;

    this.logger.log(`Processing message for session ${sessionId}: ${userMessage}`);

    // Get AI response
    const aiResponse = await this.llmService.generateResponse(
      session.messages,
      session.context,
    );

    // Add AI response
    const assistantMsg: Message = {
      role: 'assistant',
      content: aiResponse,
    };
    session.messages.push(assistantMsg);

    // Keep history manageable (last 20 messages)
    if (session.messages.length > 20) {
      session.messages = session.messages.slice(-20);
    }

    return aiResponse;
  }

  async setInterrupted(sessionId: string, interrupted: boolean): Promise<void> {
    const session = this.sessions.get(sessionId);
    
    if (session) {
      session.interrupted = interrupted;
    }
  }

  async endSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    
    if (session) {
      this.logger.log(
        `Ending session ${sessionId}. Total messages: ${session.messages.length}`,
      );
      this.sessions.delete(sessionId);
    }
  }

  async clearHistory(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    
    if (session) {
      session.messages = [];
      session.lastActivityAt = new Date();
      this.logger.log(`Cleared history for session ${sessionId}`);
    }
  }

  /**
   * Get all active sessions (for admin/monitoring)
   */
  async getActiveSessions(): Promise<ConversationSession[]> {
    return Array.from(this.sessions.values());
  }

  /**
   * Get sessions by user ID
   */
  async getUserSessions(userId: string): Promise<ConversationSession[]> {
    return Array.from(this.sessions.values())
      .filter(session => session.userId === userId);
  }
}
