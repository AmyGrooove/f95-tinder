import { Injectable } from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import { isObjectIdOrHexString, Types } from "mongoose"
import type { HydratedDocument, Model } from "mongoose"

import { MongoTransactionService } from "@infrastructure/database/services/mongoTransaction.service"
import { isObject } from "@shared/functions/checks/isObject"
import { isNil } from "@shared/functions/checks/isNil"
import { TagItem } from "../schemas/tagItem.schema"
import type { ITagItemMutationProps } from "../types/ITagItemMutationProps"
import { TagItemEventsService } from "./tagItemEvents.service"

@Injectable()
class TagItemMutationService {
  constructor(
    @InjectModel(TagItem.name)
    private readonly model: Model<HydratedDocument<TagItem>>,
    private readonly events: TagItemEventsService,
    private readonly transactionService: MongoTransactionService,
  ) {}

  async run<TResult>(props: ITagItemMutationProps<TResult>): Promise<TResult> {
    this.transactionService.assertManagedSession(props.session)

    const previous =
      !isNil(props.filters) && props.filters.length > 0
        ? await this.model
            .find(
              { $or: props.filters },
              { _id: 1, item: 1 },
              { session: props.session },
            )
            .lean()
            .exec()
        : []

    const publish = async (result: unknown) => {
      const recordIds = [
        ...previous.map((record) => record._id),
        ...this.getRecordIds(result),
      ]
      const current =
        recordIds.length > 0
          ? await this.model
              .find(
                { _id: { $in: recordIds } },
                { item: 1 },
                { session: props.session },
              )
              .lean()
              .exec()
          : []

      await this.events.publishChanged(
        [
          ...previous.map((record) => record.item),
          ...current.map((record) => record.item),
          ...(props.itemIds ?? []),
        ],
        props.session,
      )
    }

    let result: TResult

    try {
      result = await props.mutate()
    } catch (error) {
      if (
        props.isPartialWritePossible === true &&
        props.session?.inTransaction() !== true
      ) {
        await publish(
          isObject(error) && "result" in error ? error.result : undefined,
        )
      }

      throw error
    }

    await publish(result)
    return result
  }

  private getRecordIds(result: unknown): Types.ObjectId[] {
    if (Array.isArray(result)) {
      return result.flatMap((entry: unknown) => this.getRecordIds(entry))
    }

    if (!isObject(result)) {
      return []
    }

    const ids: Types.ObjectId[] = []

    for (const value of [
      "_id" in result ? result._id : undefined,
      "upsertedId" in result ? result.upsertedId : undefined,
    ]) {
      if (isObjectIdOrHexString(value)) {
        ids.push(new Types.ObjectId(String(value)))
      }
    }

    for (const values of [
      "insertedIds" in result ? result.insertedIds : undefined,
      "upsertedIds" in result ? result.upsertedIds : undefined,
    ]) {
      if (isObject(values)) {
        for (const value of Object.values(values)) {
          if (isObjectIdOrHexString(value)) {
            ids.push(new Types.ObjectId(String(value)))
          }
        }
      }
    }

    return ids
  }
}

export { TagItemMutationService }
