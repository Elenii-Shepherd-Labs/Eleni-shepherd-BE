import { Injectable, Logger, NotFoundException, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { LlmService } from '../llm/llm.service';
import { Message } from '../llm/dto';
import { ConversationSession } from './interfaces/conversation-session.interface';
import { Types } from 'mongoose';
import { IAppResponse } from '@app/common/interfaces/response.interface';
import { createAppResponse } from '@app/common/utils/response';

type ConversationClientAction =
  | { type: 'navigate'; screen: string }
  | { type: 'play_radio'; genre?: string }
  | { type: 'read_news'; category?: string }
  | { type: 'vision_scan' }
  | { type: 'set_listen_mode'; enabled: boolean }
  | { type: 'stop_audio' };

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
      lastActivityAt: session.lastActivityAt
        ? new Date(session.lastActivityAt)
        : new Date(),
    } as ConversationSession;
  }

  private normalizeUtterance(text: string) {
    return text
      .toLowerCase()
      .replace(/[^\w\s']/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private deriveClientActions(
    userMessage: string,
    currentRoute?: string,
  ): ConversationClientAction[] {
    const normalized = this.normalizeUtterance(userMessage);
    if (!normalized) {
      return [];
    }

    const actions: ConversationClientAction[] = [];
    const hasAny = (...phrases: string[]) =>
      phrases.some((phrase) => normalized.includes(phrase));
    const route = currentRoute?.trim() || '';

    if (hasAny('stop', 'quiet', 'pause')) {
      actions.push({ type: 'stop_audio' });
      return actions;
    }

    if (hasAny('switch mode', 'listen mode', 'always listen', 'tap to listen')) {
      actions.push({
        type: 'set_listen_mode',
        enabled: hasAny('always'),
      });
      return actions;
    }

    if (hasAny('settings')) {
      actions.push({ type: 'navigate', screen: 'Settings' });
      return actions;
    }

    if (hasAny('home', 'dashboard')) {
      actions.push({ type: 'navigate', screen: 'Home' });
      return actions;
    }

    if (hasAny('news', 'headline', 'headlines')) {
      if (hasAny('open', 'go', 'navigate')) {
        actions.push({ type: 'navigate', screen: 'News' });
      } else {
        if (route !== 'News') {
          actions.push({ type: 'navigate', screen: 'News' });
        }
        actions.push({ type: 'read_news', category: 'news' });
      }
      return actions;
    }

    if (hasAny('radio', 'station', 'music')) {
      if (hasAny('open', 'go', 'navigate')) {
        actions.push({ type: 'navigate', screen: 'Radio' });
      } else {
        if (route !== 'Radio') {
          actions.push({ type: 'navigate', screen: 'Radio' });
        }

        let genre = 'Nigeria';
        if (hasAny('jazz')) genre = 'Jazz';
        else if (hasAny('gospel')) genre = 'Gospel';

        actions.push({ type: 'play_radio', genre });
      }
      return actions;
    }

    if (hasAny('scan', 'what is this', 'look at', 'read this')) {
      actions.push({ type: 'vision_scan' });
      return actions;
    }

    if (hasAny('navigate', 'walk', 'path', 'ahead', 'route')) {
      actions.push({ type: 'navigate', screen: 'Navigation' });
      return actions;
    }

    return actions;
  }

  private buildActionAcknowledgement(
    actions: ConversationClientAction[],
  ): string | null {
    const primary = actions[0];
    if (!primary) {
      return null;
    }

    switch (primary.type) {
      case 'stop_audio':
        return 'Stopping audio now.';
      case 'set_listen_mode':
        return `Switched to ${
          primary.enabled ? 'always listen' : 'tap to listen'
        } mode.`;
      case 'navigate':
        if (primary.screen === 'Navigation') {
          return 'Opening navigation now.';
        }
        return `Opening ${primary.screen.toLowerCase()} now.`;
      case 'play_radio':
        return `Opening radio and tuning into ${
          primary.genre || 'Nigeria'
        } stations.`;
      case 'read_news':
        return 'Opening news and reading the latest headlines.';
      case 'vision_scan':
        return 'Starting a quick scan now.';
      default:
        return null;
    }
  }

  private shouldShortCircuitToActionResponse(
    userMessage: string,
    actions: ConversationClientAction[],
  ) {
    if (actions.length === 0) {
      return false;
    }

    const normalized = this.normalizeUtterance(userMessage);
    const words = normalized.split(' ').filter(Boolean);
    return (
      words.length <= 8 ||
      normalized.startsWith('open ') ||
      normalized.startsWith('go ') ||
      normalized.startsWith('play ') ||
      normalized.startsWith('read ') ||
      normalized.startsWith('scan ') ||
      normalized.startsWith('navigate ') ||
      normalized.startsWith('stop ') ||
      normalized.startsWith('switch ')
    );
  }

  private buildEffectiveContext(
    sessionContext: string,
    currentRoute?: string,
    extraContext?: string,
  ) {
    const contextParts = [sessionContext];

    if (currentRoute) {
      contextParts.push(`Current mobile route: ${currentRoute}.`);
    }

    if (extraContext) {
      contextParts.push(extraContext);
    }

    return contextParts.filter(Boolean).join('\n');
  }

  async initializeSession(
    sessionId: string,
    userId?: Types.ObjectId | string,
  ): Promise<IAppResponse> {
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
    this.logger.log(
      `Session initialized: ${sessionId}${userId ? ` for user ${userId}` : ''}`,
    );

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
    const rawResp = (await this.getSession(sessionId)) as IAppResponse;
    if (!rawResp.success) return rawResp;

    const session = rawResp.data as ConversationSession;
    session.context = context;
    session.lastActivityAt = new Date();
    await this.cacheManager.set(this.sessionKey(sessionId), session);

    this.logger.log(
      `Context added to session ${sessionId}: ${context.substring(0, 100)}...`,
    );
    return createAppResponse(true, 'Context added', session, 200);
  }

  async processMessage(
    sessionId: string,
    userMessage: string,
    currentRoute?: string,
    extraContext?: string,
  ): Promise<IAppResponse> {
    const rawResp = (await this.getSession(sessionId)) as IAppResponse;
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

    this.logger.log(
      `Processing message for session ${sessionId}: ${userMessage}`,
    );

    const actions = this.deriveClientActions(userMessage, currentRoute);
    const actionAcknowledgement = this.buildActionAcknowledgement(actions);

    let aiText = actionAcknowledgement || '';

    if (!this.shouldShortCircuitToActionResponse(userMessage, actions)) {
      const aiResponseResp = await this.llmService.generateResponse(
        session.messages,
        this.buildEffectiveContext(session.context, currentRoute, extraContext),
      );
      aiText =
        (aiResponseResp.data as { response?: string } | null)?.response ||
        actionAcknowledgement ||
        'I apologize, but I could not generate a response.';
    }

    // Add AI response
    const assistantMsg: Message = {
      role: 'assistant',
      content: aiText,
    };
    session.messages.push(assistantMsg);

    // Keep history manageable (last 20 messages)
    if (session.messages.length > 20) {
      session.messages = session.messages.slice(-20);
    }

    await this.cacheManager.set(this.sessionKey(sessionId), session);

    return createAppResponse(
      true,
      'Message processed',
      { response: aiText, sessionId, actions },
      200,
    );
  }

  async setInterrupted(
    sessionId: string,
    interrupted: boolean,
  ): Promise<IAppResponse> {
    const rawResp = (await this.getSession(sessionId)) as IAppResponse;
    if (!rawResp.success) return rawResp;

    const session = rawResp.data as ConversationSession;
    session.interrupted = interrupted;
    await this.cacheManager.set(this.sessionKey(sessionId), session);
    return createAppResponse(
      true,
      'Session interrupted flag updated',
      session,
      200,
    );
  }

  async endSession(sessionId: string): Promise<IAppResponse> {
    const rawResp = (await this.getSession(sessionId)) as IAppResponse;
    if (!rawResp.success) return rawResp;

    const session = rawResp.data as ConversationSession;
    this.logger.log(
      `Ending session ${sessionId}. Total messages: ${session.messages.length}`,
    );
    await this.cacheManager.del(this.sessionKey(sessionId));
    await this.removeActiveSessionId(sessionId);
    return createAppResponse(true, 'Session ended', null, 200);
  }

  async clearHistory(sessionId: string): Promise<IAppResponse> {
    const rawResp = (await this.getSession(sessionId)) as IAppResponse;
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
    const ids: string[] =
      (await this.cacheManager.get(this.activeSessionsKey())) || [];
    const sessionResponses = await Promise.all(
      ids.map((id) => this.getSession(id)),
    );
    const sessions = sessionResponses
      .map((r) => (r as IAppResponse).data)
      .filter(Boolean) as ConversationSession[];
    return createAppResponse(true, 'Active sessions retrieved', sessions, 200);
  }

  /**
   * Get sessions by user ID
   */
  async getUserSessions(
    userId: Types.ObjectId | string,
  ): Promise<IAppResponse> {
    const allResp = (await this.getActiveSessions()) as IAppResponse;
    if (!allResp.success) return allResp;
    const all = allResp.data as ConversationSession[];
    const filtered = all.filter(
      (session) => String(session.userId) === String(userId),
    );
    return createAppResponse(true, 'User sessions retrieved', filtered, 200);
  }
}
