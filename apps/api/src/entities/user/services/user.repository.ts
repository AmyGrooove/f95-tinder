import { Injectable } from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import { Model, Types } from "mongoose"

import { User, type UserDocument } from "../schemas/user.schema"
import type { TCreateUserPayload } from "../types/TCreateUserPayload"

@Injectable()
class UserRepository {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  createUser(payload: TCreateUserPayload): Promise<UserDocument> {
    return this.userModel.create(payload)
  }

  findById(userId: string | Types.ObjectId): Promise<UserDocument | null> {
    return this.userModel.findById(userId).exec()
  }

  findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email: email.toLowerCase() }).exec()
  }

  updateLoginDate(
    userId: string | Types.ObjectId,
    lastLoginAt: Date,
  ): Promise<UserDocument | null> {
    return this.userModel
      .findByIdAndUpdate(userId, { lastLoginAt }, { new: true })
      .exec()
  }
}

export { UserRepository }
