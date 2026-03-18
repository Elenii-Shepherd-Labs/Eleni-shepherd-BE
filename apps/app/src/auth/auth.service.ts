import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from './user.schema';
import crypto from 'crypto';
import { createMobileAuthToken, verifyMobileAuthToken } from './mobile-auth.util';
import { OAuth2Client, TokenPayload } from 'google-auth-library';

@Injectable()
export class AuthService {
  private readonly mobileExchangeCodes = new Map<
    string,
    { userId: string; expiresAt: number }
  >();
  private readonly oauthRedirectStates = new Map<
    string,
    { redirectUrl: string; expiresAt: number }
  >();
  private readonly googleClient: OAuth2Client;

  constructor(@InjectModel(User.name) private userModel: Model<User>) {
    this.googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
  }

  private getRequiredGoogleClientId(): string {
    const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
    if (!clientId) {
      throw new Error('GOOGLE_CLIENT_ID environment variable is required');
    }

    return clientId;
  }

  async validateUser(
    googleId: string,
    email: string,
    username: string,
  ): Promise<User> {
    let user = await this.userModel.findOne({ googleId });
    if (!user) {
      user = await this.userModel.create({ googleId, email, username });
    } else {
      const nextEmail = email.trim();
      const nextUsername = username.trim();
      let shouldSave = false;

      if (nextEmail && user.email !== nextEmail) {
        user.email = nextEmail;
        shouldSave = true;
      }

      if (nextUsername && user.username !== nextUsername) {
        user.username = nextUsername;
        shouldSave = true;
      }

      if (shouldSave) {
        await user.save();
      }
    }

    return user as unknown as User;
  }

  async findById(id: string): Promise<User> {
    return this.userModel.findById(id);
  }

  async findByGoogleId(googleId: string): Promise<User> {
    return this.userModel.findOne({ googleId });
  }

  async verifyGoogleIdToken(idToken: string): Promise<TokenPayload | null> {
    const audience = this.getRequiredGoogleClientId();

    const ticket = await this.googleClient.verifyIdToken({
      idToken,
      audience,
    });

    return ticket.getPayload() || null;
  }

  async validateMobileGoogleUser(idToken: string): Promise<User> {
    const payload = await this.verifyGoogleIdToken(idToken);
    if (!payload?.sub || !payload?.email) {
      throw new Error('Google ID token payload is missing required fields');
    }

    if (payload.email_verified === false) {
      throw new Error('Google email must be verified');
    }

    const displayName =
      payload.name ||
      [payload.given_name, payload.family_name].filter(Boolean).join(' ') ||
      payload.email;

    return this.validateUser(payload.sub, payload.email, displayName);
  }

  createMobileExchangeCode(userId: string): string {
    const code = crypto.randomBytes(24).toString('hex');

    this.cleanupExpiredExchangeCodes();
    this.mobileExchangeCodes.set(code, {
      userId,
      expiresAt: Date.now() + 1000 * 60 * 5,
    });

    return code;
  }

  createOAuthRedirectState(redirectUrl: string): string {
    const state = crypto.randomBytes(24).toString('hex');

    this.cleanupExpiredOAuthRedirectStates();
    this.oauthRedirectStates.set(state, {
      redirectUrl,
      expiresAt: Date.now() + 1000 * 60 * 10,
    });

    return state;
  }

  consumeOAuthRedirectState(state: string): string | null {
    const record = this.oauthRedirectStates.get(state);
    if (!record) {
      return null;
    }

    this.oauthRedirectStates.delete(state);

    if (record.expiresAt <= Date.now()) {
      return null;
    }

    return record.redirectUrl;
  }

  async consumeMobileExchangeCode(code: string): Promise<User | null> {
    const record = this.mobileExchangeCodes.get(code);
    if (!record) {
      return null;
    }

    this.mobileExchangeCodes.delete(code);

    if (record.expiresAt <= Date.now()) {
      return null;
    }

    return this.findById(record.userId);
  }

  issueMobileAuthToken(user: User): string {
    return createMobileAuthToken(String(user.id || user._id));
  }

  async findUserByMobileAuthToken(token?: string | null): Promise<User | null> {
    const payload = verifyMobileAuthToken(token);
    if (!payload?.sub) {
      return null;
    }

    return this.findById(payload.sub);
  }

  private cleanupExpiredExchangeCodes() {
    const now = Date.now();
    for (const [code, record] of this.mobileExchangeCodes.entries()) {
      if (record.expiresAt <= now) {
        this.mobileExchangeCodes.delete(code);
      }
    }
  }

  private cleanupExpiredOAuthRedirectStates() {
    const now = Date.now();
    for (const [state, record] of this.oauthRedirectStates.entries()) {
      if (record.expiresAt <= now) {
        this.oauthRedirectStates.delete(state);
      }
    }
  }
}
