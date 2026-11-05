import type { Types } from "mongoose"

import type { UpdateCollectionBodyDto } from "../dto/updateCollection.body"

interface IUpdateCollectionRequestProps {
  id: Types.ObjectId
  body: UpdateCollectionBodyDto
}

export type { IUpdateCollectionRequestProps }
