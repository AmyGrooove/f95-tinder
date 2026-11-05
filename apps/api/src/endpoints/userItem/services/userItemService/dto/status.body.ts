import { ApiProperty } from "@nestjs/swagger"
import { IsIn } from "class-validator"

import { EUserItemStatus } from "@entities/userItem/schemas/EUserItemStatus"
import { USER_ITEM_LIBRARY_STATUSES } from "@entities/userItem/static/USER_ITEM_LIBRARY_STATUSES"

class StatusBodyDto {
  @ApiProperty({ enum: [...USER_ITEM_LIBRARY_STATUSES] })
  @IsIn(USER_ITEM_LIBRARY_STATUSES)
  status: EUserItemStatus
}

export { StatusBodyDto }
