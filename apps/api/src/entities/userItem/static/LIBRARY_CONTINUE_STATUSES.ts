import { EUserItemStatus } from "../schemas/EUserItemStatus"

const LIBRARY_CONTINUE_STATUSES = [
  EUserItemStatus.IN_PROGRESS,
  EUserItemStatus.ON_HOLD,
  EUserItemStatus.PLANNED,
] as const

export { LIBRARY_CONTINUE_STATUSES }
