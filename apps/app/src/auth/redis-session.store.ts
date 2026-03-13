import session, { SessionData } from 'express-session';
import Redis from 'ioredis';

type SessionCallback<T = void> = (err?: unknown, data?: T) => void;

interface RedisSessionStoreOptions {
  prefix?: string;
  defaultTtlSeconds?: number;
  disableTouch?: boolean;
}

function getSessionTtlSeconds(
  storeSession: SessionData,
  fallbackSeconds: number,
): number {
  const cookie = storeSession?.cookie;

  if (cookie?.expires) {
    const expiresAt =
      cookie.expires instanceof Date
        ? cookie.expires.getTime()
        : new Date(cookie.expires).getTime();

    if (!Number.isNaN(expiresAt)) {
      return Math.max(1, Math.ceil((expiresAt - Date.now()) / 1000));
    }
  }

  if (typeof cookie?.originalMaxAge === 'number') {
    return Math.max(1, Math.ceil(cookie.originalMaxAge / 1000));
  }

  return fallbackSeconds;
}

export class RedisSessionStore extends session.Store {
  private readonly prefix: string;
  private readonly defaultTtlSeconds: number;
  private readonly disableTouch: boolean;

  constructor(
    private readonly client: Redis,
    options: RedisSessionStoreOptions = {},
  ) {
    super();
    this.prefix = options.prefix || 'session:';
    this.defaultTtlSeconds = options.defaultTtlSeconds || 60 * 60;
    this.disableTouch = options.disableTouch ?? false;
  }

  private sessionKey(sessionId: string) {
    return `${this.prefix}${sessionId}`;
  }

  private withCallback<T>(
    callback: SessionCallback<T> | undefined,
    promise: Promise<T>,
  ) {
    promise.then((result) => callback?.(undefined, result)).catch((error) => {
      callback?.(error);
    });
  }

  get(sessionId: string, callback: SessionCallback<SessionData | null>) {
    this.withCallback(
      callback,
      (async () => {
        const stored = await this.client.get(this.sessionKey(sessionId));
        return stored ? (JSON.parse(stored) as SessionData) : null;
      })(),
    );
  }

  set(sessionId: string, storeSession: SessionData, callback?: SessionCallback) {
    this.withCallback(
      callback,
      (async () => {
        const ttlSeconds = getSessionTtlSeconds(
          storeSession,
          this.defaultTtlSeconds,
        );

        await this.client.set(
          this.sessionKey(sessionId),
          JSON.stringify(storeSession),
          'EX',
          ttlSeconds,
        );
      })(),
    );
  }

  destroy(sessionId: string, callback?: SessionCallback) {
    this.withCallback(
      callback,
      this.client.del(this.sessionKey(sessionId)).then(() => undefined),
    );
  }

  touch(
    sessionId: string,
    storeSession: SessionData,
    callback?: SessionCallback,
  ) {
    if (this.disableTouch) {
      callback?.();
      return;
    }

    this.withCallback(
      callback,
      (async () => {
        const ttlSeconds = getSessionTtlSeconds(
          storeSession,
          this.defaultTtlSeconds,
        );

        await this.client.expire(this.sessionKey(sessionId), ttlSeconds);
      })(),
    );
  }
}
