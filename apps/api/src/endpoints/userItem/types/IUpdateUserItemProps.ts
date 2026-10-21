import type { Types } from "mongoose"

import type { UpdateUserItemBodyDto } from "../dto/body/updateUserItem.body"

interface IUpdateUserItemProps {
  id: Types.ObjectId
  body: UpdateUserItemBodyDto
}

export type { IUpdateUserItemProps }
