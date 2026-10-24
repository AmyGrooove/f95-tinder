import { EUserItemStatus } from "../schemas/EUserItemStatus"

const USER_ITEM_LIBRARY_STATUSES: readonly EUserItemStatus[] = [
  EUserItemStatus.PLANNED,
  EUserItemStatus.IN_PROGRESS,
  EUserItemStatus.ON_HOLD,
  EUserItemStatus.COMPLETED,
  EUserItemStatus.DROPPED,
]

export { USER_ITEM_LIBRARY_STATUSES }
