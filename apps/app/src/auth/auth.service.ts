import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from './user.schema';

@Injectable()
export class AuthService {
  constructor(@InjectModel(User.name) private userModel: Model<User>) {}

  async validateUser(googleId: string, email: string, username: string): Promise<User> {
    let user = await this.userModel.findOne({ googleId });
    if (!user) {
      user = await this.userModel.create({ googleId, email, username });
    }
    return user;
  }

  async findById(id: string): Promise<User> {
    return this.userModel.findById(id);
  }

  async findByGoogleId(googleId: string): Promise<User> {
    return this.userModel.findOne({ googleId });
  }
}