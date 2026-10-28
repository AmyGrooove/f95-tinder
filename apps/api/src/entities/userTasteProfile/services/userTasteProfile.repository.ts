import { Injectable } from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import type { HydratedDocument, Model } from "mongoose"
import { mongo } from "mongoose"
import type { Types } from "mongoose"

import { MongoReadRepository } from "@infrastructure/database/services/mongoRead.repository"
import { MongoWriteRepository } from "@infrastructure/database/services/mongoWrite.repository"
import { MongoPaginationRepository } from "@infrastructure/database/services/mongoPagination.repository"
import { MongoBulkRepository } from "@infrastructure/database/services/mongoBulk.repository"
import { MongoAggregationRepository } from "@infrastructure/database/services/mongoAggregation.repository"

import { UserTasteProfile } from "../schemas/userTasteProfile.schema"
import type { TCreateUserTasteProfile } from "../schemas/userTasteProfile.schema"
import type { TasteTagPreference } from "../schemas/tasteTagPreference.schema"
import type { IReplaceCalculatedPreferencesProps } from "../types/IReplaceCalculatedPreferencesProps"

@Injectable()
class UserTasteProfileRepository {
  readonly read: MongoReadRepository<
    UserTasteProfile,
    HydratedDocument<UserTasteProfile>
  >
  readonly write: MongoWriteRepository<
    UserTasteProfile,
    HydratedDocument<UserTasteProfile>,
    TCreateUserTasteProfile
  >
  readonly pagination: MongoPaginationRepository<
    UserTasteProfile,
    HydratedDocument<UserTasteProfile>
  >
  readonly bulk: MongoBulkRepository<
    UserTasteProfile,
    HydratedDocument<UserTasteProfile>,
    TCreateUserTasteProfile
  >
  readonly aggregation: MongoAggregationRepository<
    HydratedDocument<UserTasteProfile>
  >

  constructor(
    @InjectModel(UserTasteProfile.name)
    private readonly model: Model<HydratedDocument<UserTasteProfile>>,
  ) {
    this.read = new MongoReadRepository<
      UserTasteProfile,
      HydratedDocument<UserTasteProfile>
    >(model)
    this.write = new MongoWriteRepository<
      UserTasteProfile,
      HydratedDocument<UserTasteProfile>,
      TCreateUserTasteProfile
    >(model)
    this.pagination = new MongoPaginationRepository<
      UserTasteProfile,
      HydratedDocument<UserTasteProfile>
    >(model)
    this.bulk = new MongoBulkRepository<
      UserTasteProfile,
      HydratedDocument<UserTasteProfile>,
      TCreateUserTasteProfile
    >(model)
    this.aggregation = new MongoAggregationRepository<
      HydratedDocument<UserTasteProfile>
    >(model)
  }

  async readTagPreferences(userId: Types.ObjectId) {
    const profile = await this.model
      .findOne({ user: userId }, { tagPreferences: 1 })
      .lean()
      .exec()

    return profile?.tagPreferences ?? null
  }

  async tryReplaceCalculatedPreferences(
    props: IReplaceCalculatedPreferencesProps,
  ) {
    const { userId, tagIds, preferences, previousPreferences } = props
    const affectedTagIds = new Set(tagIds.map(String))
    const preferencesByTag = new Map<string, TasteTagPreference>(
      preferences.map((preference) => [
        String(preference.tag),
        { ...preference, explicitWeight: 0 },
      ]),
    )

    for (const preference of previousPreferences ?? []) {
      if (!affectedTagIds.has(String(preference.tag))) {
        preferencesByTag.set(String(preference.tag), preference)
      } else if (preference.explicitWeight !== 0) {
        const calculatedPreference = preferencesByTag.get(
          String(preference.tag),
        )

        preferencesByTag.set(String(preference.tag), {
          tag: preference.tag,
          weight: calculatedPreference?.weight ?? 0,
          count: calculatedPreference?.count ?? 0,
          explicitWeight: preference.explicitWeight,
        })
      }
    }

    const tagPreferences = [...preferencesByTag.values()]

    if (previousPreferences === null) {
      if (tagPreferences.length === 0) {
        return true
      }

      try {
        await this.write.create({ user: userId, tagPreferences })

        return true
      } catch (error) {
        if (
          error instanceof mongo.MongoServerError &&
          error.code === 11000 &&
          error.keyPattern?.user === 1
        ) {
          return false
        }

        throw error
      }
    }

    const updatedProfile = await this.write.updateByFilter(
      {
        user: userId,
        $expr: {
          $eq: [{ $literal: previousPreferences }, "$tagPreferences"],
        },
      },
      { $set: { tagPreferences } },
    )

    return updatedProfile !== null
  }
}

export { UserTasteProfileRepository }
