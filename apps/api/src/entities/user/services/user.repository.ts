import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { User, type UserDocument } from '../schemas/user.schema';

export interface CreateUserRecord {
  tokenHash: string;
  tokenEncrypted: string;
  tokenEncryptionIv: string;
  tokenEncryptionTag: string;
  tokenEncryptionKeyVersion: string;
}

@Injectable()
export class UserRepository {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<User>,
  ) {}

  create(record: CreateUserRecord): Promise<UserDocument> {
    return this.userModel.create(record);
  }

  async findIdByTokenHash(
    tokenHash: string,
  ): Promise<{ id: string } | null> {
    const user = await this.userModel
      .findOne({ tokenHash })
      .select({ _id: 1 })
      .lean()
      .exec();

    return user ? { id: String(user._id) } : null;
  }

  findTokenById(userId: string): Promise<UserDocument | null> {
    return this.userModel
      .findById(userId)
      .select(
        '+tokenEncrypted +tokenEncryptionIv +tokenEncryptionTag +tokenEncryptionKeyVersion',
      )
      .exec();
  }
}
