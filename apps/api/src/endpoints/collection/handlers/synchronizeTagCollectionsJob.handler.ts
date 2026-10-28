import { Injectable } from "@nestjs/common"
import { Types } from "mongoose"

import { ItemTagRepository } from "@entities/itemTag/services/itemTag.repository"
import { CollectionRepository } from "@entities/collection/services/collection.repository"
import { CollectionItemRepository } from "@entities/collectionItem/services/collectionItem.repository"
import { ECollectionType } from "@entities/collection/schemas/ECollectionType"
import { ECollectionBlockType } from "@entities/collection/schemas/ECollectionBlockType"
import { JobHandler } from "@infrastructure/jobs/decorators/JobHandler"
import type { IJobHandler } from "@infrastructure/jobs/types/IJobHandler"
import type { IJobContext } from "@infrastructure/jobs/types/IJobContext"
import { isNil } from "@shared/functions/checks/isNil"

import { SYNCHRONIZE_TAG_COLLECTIONS_JOB } from "../static/SYNCHRONIZE_TAG_COLLECTIONS_JOB"

@Injectable()
@JobHandler(SYNCHRONIZE_TAG_COLLECTIONS_JOB)
class SynchronizeTagCollectionsJobHandler implements IJobHandler<string> {
  constructor(
    private readonly itemTags: ItemTagRepository,
    private readonly collections: CollectionRepository,
    private readonly collectionItems: CollectionItemRepository,
  ) {}

  async handle(payload: string, context: IJobContext) {
    const item = new Types.ObjectId(payload)
    await context.throwIfCancelled()

    const assignments = await this.itemTags.read.findMany(
      { item },
      { tag: 1, relevanceScore: 1 },
    )
    const memberships = await this.collectionItems.read.findMany(
      { item },
      { collectionId: 1 },
    )
    const collections = await this.collections.read.findMany({
      type: ECollectionType.TAG,
      author: null,
      tag: { $ne: null },
      $or: [
        { tag: { $in: assignments.map((assignment) => assignment.tag) } },
        {
          _id: {
            $in: memberships.map((membership) => membership.collectionId),
          },
        },
      ],
    })
    const scores = new Map(
      assignments.map((assignment) => [
        String(assignment.tag),
        assignment.relevanceScore,
      ]),
    )

    for (const collection of collections) {
      await context.throwIfCancelled()
      const relevanceScore = scores.get(String(collection.tag))

      if (isNil(relevanceScore) || !isNil(collection.deletedAt)) {
        await this.collectionItems.write.deleteByFilter({
          collectionId: collection._id,
          item,
        })
        continue
      }

      const group = collection.blocks.find(
        (block) => block.type === ECollectionBlockType.GROUP,
      )

      if (isNil(group)) {
        throw new Error(`Tag collection has no group: ${collection._id}`)
      }

      await this.collectionItems.write.updateByFilter(
        { collectionId: collection._id, item },
        {
          $set: { relevanceScore },
          $setOnInsert: {
            collectionId: collection._id,
            item,
            groupId: group.id,
            position: 0,
          },
        },
        { upsert: true },
      )
    }

    return { processedItems: 1 }
  }
}

export { SynchronizeTagCollectionsJobHandler }
