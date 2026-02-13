import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { User } from '../auth/user.schema';
import { Model } from 'mongoose';
import { SaveFullNameDto } from './dto';

@Injectable()
export class OnboardingService {
  constructor(@InjectModel(User.name) private userModel: Model<User>) {}
  async saveName(userId: string, name: string, nameType: string) {
    const user = await this.userModel.findById(userId);

    user.fullname[nameType] = name;
    await user.save();

    return user.fullname;
  }

  async saveFullname(userId: string, fullname: SaveFullNameDto) {
    const user = await this.userModel.findByIdAndUpdate(
      userId,
      {
        $set: { fullname },
      },
      { new: true },
    );
    return user.fullname;
  }
}
