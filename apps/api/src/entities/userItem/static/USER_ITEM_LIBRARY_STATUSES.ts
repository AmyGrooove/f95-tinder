import { EUserItemStatus } from "../schemas/EUserItemStatus"

const USER_ITEM_LIBRARY_STATUSES = [
  EUserItemStatus.PLANNED,
  EUserItemStatus.IN_PROGRESS,
  EUserItemStatus.ON_HOLD,
  EUserItemStatus.COMPLETED,
  EUserItemStatus.DROPPED,
] as const satisfies readonly EUserItemStatus[]

export { USER_ITEM_LIBRARY_STATUSES }
