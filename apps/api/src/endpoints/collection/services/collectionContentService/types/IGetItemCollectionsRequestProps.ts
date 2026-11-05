import type { Types } from "mongoose"

import type { ItemCollectionsBodyDto } from "@endpoints/collection/dto/body/itemCollections.body"

interface IGetItemCollectionsRequestProps {
  id: Types.ObjectId
  query: ItemCollectionsBodyDto
}

export type { IGetItemCollectionsRequestProps }
