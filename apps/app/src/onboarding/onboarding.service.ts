import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { User } from '../auth/user.schema';
import { Model } from 'mongoose';
import { SaveFullNameDto } from './dto';
import { NameField } from './dto/save-name-as-text.dto';
import { IAppResponse } from '@app/common/interfaces/response.interface';
import { createAppResponse } from '@app/common/utils/response';
import { isValidObjectId } from 'mongoose';

@Injectable()
export class OnboardingService {
  constructor(@InjectModel(User.name) private userModel: Model<User>) {}

  private normalizeNameField(
    nameType: NameField,
  ): 'firstname' | 'lastname' | 'middlename' {
    if (nameType === 'lastName') return 'lastname';
    if (nameType === 'middleName') return 'middlename';
    return 'firstname';
  }

  private toClientFullname(fullname?: Record<string, string | undefined>) {
    return {
      firstName: fullname?.firstname || '',
      lastName: fullname?.lastname || '',
      middleName: fullname?.middlename || '',
    };
  }

  private toStoredFullname(fullname: {
    firstName?: string;
    lastName?: string;
    middleName?: string;
  }) {
    return {
      firstname: fullname.firstName || undefined,
      lastname: fullname.lastName || undefined,
      middlename: fullname.middleName || undefined,
    };
  }

  async saveName(
    userId: string,
    name: string,
    nameType: NameField,
  ): Promise<IAppResponse> {
    if (!isValidObjectId(userId)) {
      return createAppResponse(false, 'Valid user context is required', null, 400);
    }

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
    if (!isValidObjectId(userId)) {
      return createAppResponse(false, 'Valid user context is required', null, 400);
    }

    const nextFullname = this.toStoredFullname(fullname);

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

  async completeOnboarding(userId: string): Promise<IAppResponse> {
    if (!isValidObjectId(userId)) {
      return createAppResponse(false, 'Valid user context is required', null, 400);
    }

    const user = await this.userModel.findByIdAndUpdate(
      userId,
      {
        $set: { onboardingComplete: true },
      },
      { new: true },
    );

    if (!user) {
      return createAppResponse(false, 'User not found', null, 404);
    }

    return createAppResponse(
      true,
      'Onboarding completed',
      {
        onboardingComplete: Boolean(user.onboardingComplete),
      },
      200,
    );
  }
}
