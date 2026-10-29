import type { Types } from "mongoose"

import type { ItemCollectionsBodyDto } from "../dto/body/itemCollections.body"

interface IGetItemCollectionsRequestProps {
  id: Types.ObjectId
  query: ItemCollectionsBodyDto
}

export type { IGetItemCollectionsRequestProps }
