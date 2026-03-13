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

  private normalizeNameField(nameType: string): 'firstname' | 'lastname' | 'middlename' {
    const normalized = nameType.replace(/[^a-zA-Z]/g, '').toLowerCase();

    if (normalized === 'lastname') return 'lastname';
    if (normalized === 'middlename') return 'middlename';
    return 'firstname';
  }

  private toClientFullname(fullname?: Record<string, string | undefined>) {
    return {
      firstName: fullname?.firstname || '',
      lastName: fullname?.lastname || '',
      middleName: fullname?.middlename || '',
    };
  }

  async saveName(
    userId: string,
    name: string,
    nameType: string,
  ): Promise<IAppResponse> {
    const user = await this.userModel.findById(userId);

    if (!user) {
      return createAppResponse(false, 'User not found', null, 404);
    }

    const field = this.normalizeNameField(nameType);
    const nextFullname = {
      ...((user.fullname as unknown as Record<string, string | undefined>) || {}),
      [field]: name,
    };

    user.fullname = nextFullname as any;
    await user.save();

    return createAppResponse(
      true,
      'Name saved',
      this.toClientFullname(nextFullname),
      201,
    );
  }

  async saveFullname(
    userId: string,
    fullname: SaveFullNameDto,
  ): Promise<IAppResponse> {
    const nextFullname = {
      firstname: fullname.firstName || fullname.firstname || undefined,
      lastname: fullname.lastName || fullname.lastname || undefined,
      middlename: fullname.middleName || fullname.middlename || undefined,
    };

    const user = await this.userModel.findByIdAndUpdate(
      userId,
      {
        $set: { fullname: nextFullname },
      },
      { new: true },
    );

    if (!user) {
      return createAppResponse(false, 'User not found', null, 404);
    }

    return createAppResponse(
      true,
      'Fullname saved',
      this.toClientFullname(user.fullname as any),
      200,
    );
  }
}
