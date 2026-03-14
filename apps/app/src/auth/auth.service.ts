import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from './user.schema';
import crypto from 'crypto';
import { createMobileAuthToken, verifyMobileAuthToken } from './mobile-auth.util';

@Injectable()
export class AuthService {
  private readonly mobileExchangeCodes = new Map<
    string,
    { userId: string; expiresAt: number }
  >();

  constructor(@InjectModel(User.name) private userModel: Model<User>) {}

  async validateUser(
    googleId: string,
    email: string,
    username: string,
  ): Promise<User> {
    let user = await this.userModel.findOne({ googleId });
    if (!user) {
      user = await this.userModel.create({ googleId, email, username });
    }
    return user as unknown as User;
  }

  async findById(id: string): Promise<User> {
    return this.userModel.findById(id);
  }

  async findByGoogleId(googleId: string): Promise<User> {
    return this.userModel.findOne({ googleId });
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
}
