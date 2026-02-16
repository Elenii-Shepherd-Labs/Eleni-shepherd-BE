import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { User } from '../auth/user.schema';
import { Model } from 'mongoose';
import { SaveFullNameDto } from './dto';
import { IAppResponse } from '@app/common/interfaces/response.interface';
import { createAppResponse } from '@app/common/utils/response';

@Injectable()
export class OnboardingService {
  constructor(@InjectModel(User.name) private userModel: Model<User>) {}
  async saveName(userId: string, name: string, nameType: string): Promise<IAppResponse> {
    const user = await this.userModel.findById(userId);

    if (!user) {
      return createAppResponse(false, 'User not found', null, 404);
    }

    user.fullname[nameType] = name;
    await user.save();

    return createAppResponse(true, 'Name saved', user.fullname, 201);
  }

  async saveFullname(userId: string, fullname: SaveFullNameDto): Promise<IAppResponse> {
    const user = await this.userModel.findByIdAndUpdate(
      userId,
      {
        $set: { fullname },
      },
      { new: true },
    );

    if (!user) {
      return createAppResponse(false, 'User not found', null, 404);
    }

    return createAppResponse(true, 'Fullname saved', user.fullname, 200);
  }
}
