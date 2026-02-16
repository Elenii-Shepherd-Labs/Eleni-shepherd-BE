import { Injectable, Logger, NotFoundException, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { LlmService } from '../llm/llm.service';
import { Message } from '../llm/dto';
import { ConversationSession } from './interfaces/conversation-session.interface';
import { Types } from 'mongoose';
import { IAppResponse } from '@app/common/interfaces/response.interface';
import { createAppResponse } from '@app/common/utils/response';

@Injectable()
export class ConversationService {
  private readonly logger = new Logger(ConversationService.name);

  constructor(
    private readonly llmService: LlmService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  private sessionKey(sessionId: string) {
    return `conversation:session:${sessionId}`;
  }

  private activeSessionsKey() {
    return `conversation:active_sessions`;
  }

  private async addActiveSessionId(sessionId: string) {
    const key = this.activeSessionsKey();
    const list: string[] = (await this.cacheManager.get(key)) || [];
    if (!list.includes(sessionId)) {
      list.push(sessionId);
      await this.cacheManager.set(key, list);
    }
  }

  private async removeActiveSessionId(sessionId: string) {
    const key = this.activeSessionsKey();
    const list: string[] = (await this.cacheManager.get(key)) || [];
    const idx = list.indexOf(sessionId);
    if (idx !== -1) {
      list.splice(idx, 1);
      await this.cacheManager.set(key, list);
    }
  }

  private reviveSession(session: any): ConversationSession {
    if (!session) return session;
    return {
      ...session,
      createdAt: session.createdAt ? new Date(session.createdAt) : new Date(),
      lastActivityAt: session.lastActivityAt ? new Date(session.lastActivityAt) : new Date(),
    } as ConversationSession;
  }

  async initializeSession(sessionId: string, userId?: Types.ObjectId | string): Promise<IAppResponse> {
    const session: ConversationSession = {
      sessionId,
      userId,
      messages: [],
      context: '',
      createdAt: new Date(),
      lastActivityAt: new Date(),
      interrupted: false,
    };

    await this.cacheManager.set(this.sessionKey(sessionId), session);
    await this.addActiveSessionId(sessionId);
    this.logger.log(`Session initialized: ${sessionId}${userId ? ` for user ${userId}` : ''}`);

    return createAppResponse(true, 'Session created', session, 201);
  }

  async getSession(sessionId: string): Promise<IAppResponse> {
    const raw = await this.cacheManager.get(this.sessionKey(sessionId));
    const session = this.reviveSession(raw);
    if (!session) {
      return createAppResponse(false, 'Session not found', null, 404);
    }
    return createAppResponse(true, 'Session retrieved', session, 200);
  }

  async addContext(sessionId: string, context: string): Promise<IAppResponse> {
    const rawResp = await this.getSession(sessionId) as IAppResponse;
    if (!rawResp.success) return rawResp;

    const session = rawResp.data as ConversationSession;
    session.context = context;
    session.lastActivityAt = new Date();
    await this.cacheManager.set(this.sessionKey(sessionId), session);

    this.logger.log(`Context added to session ${sessionId}: ${context.substring(0, 100)}...`);
    return createAppResponse(true, 'Context added', session, 200);
  }

  async processMessage(sessionId: string, userMessage: string): Promise<IAppResponse> {
    const rawResp = await this.getSession(sessionId) as IAppResponse;
    if (!rawResp.success) return rawResp;

    const session = rawResp.data as ConversationSession;

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
    const aiResponseResp = await this.llmService.generateResponse(
      session.messages,
      session.context,
    );

    // Add AI response
    const assistantMsg: Message = {
      role: 'assistant',
      content: aiResponseResp.data as string,
    };
    session.messages.push(assistantMsg);

    // Keep history manageable (last 20 messages)
    if (session.messages.length > 20) {
      session.messages = session.messages.slice(-20);
    }

    await this.cacheManager.set(this.sessionKey(sessionId), session);

    return createAppResponse(true, 'Message processed', { response: aiResponseResp.data, sessionId }, 200);
  }

  async setInterrupted(sessionId: string, interrupted: boolean): Promise<IAppResponse> {
    const rawResp = await this.getSession(sessionId) as IAppResponse;
    if (!rawResp.success) return rawResp;

    const session = rawResp.data as ConversationSession;
    session.interrupted = interrupted;
    await this.cacheManager.set(this.sessionKey(sessionId), session);
    return createAppResponse(true, 'Session interrupted flag updated', session, 200);
  }

  async endSession(sessionId: string): Promise<IAppResponse> {
    const rawResp = await this.getSession(sessionId) as IAppResponse;
    if (!rawResp.success) return rawResp;

    const session = rawResp.data as ConversationSession;
    this.logger.log(`Ending session ${sessionId}. Total messages: ${session.messages.length}`);
    await this.cacheManager.del(this.sessionKey(sessionId));
    await this.removeActiveSessionId(sessionId);
    return createAppResponse(true, 'Session ended', null, 200);
  }

  async clearHistory(sessionId: string): Promise<IAppResponse> {
    const rawResp = await this.getSession(sessionId) as IAppResponse;
    if (!rawResp.success) return rawResp;

    const session = rawResp.data as ConversationSession;
    session.messages = [];
    session.lastActivityAt = new Date();
    await this.cacheManager.set(this.sessionKey(sessionId), session);
    this.logger.log(`Cleared history for session ${sessionId}`);
    return createAppResponse(true, 'History cleared', session, 200);
  }

  /**
   * Get all active sessions (for admin/monitoring)
   */
  async getActiveSessions(): Promise<IAppResponse> {
    const ids: string[] = (await this.cacheManager.get(this.activeSessionsKey())) || [];
    const sessionResponses = await Promise.all(ids.map(id => this.getSession(id)));
    const sessions = sessionResponses.map(r => (r as IAppResponse).data).filter(Boolean) as ConversationSession[];
    return createAppResponse(true, 'Active sessions retrieved', sessions, 200);
  }

  /**
   * Get sessions by user ID
   */
  async getUserSessions(userId: Types.ObjectId | string): Promise<IAppResponse> {
    const allResp = await this.getActiveSessions() as IAppResponse;
    if (!allResp.success) return allResp;
    const all = allResp.data as ConversationSession[];
    const filtered = all.filter(session => String(session.userId) === String(userId));
    return createAppResponse(true, 'User sessions retrieved', filtered, 200);
  }
}
