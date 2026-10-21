import { ApiProperty } from "@nestjs/swagger"
import { IsEnum } from "class-validator"

import { EUserItemStatus } from "@entities/userItem/schemas/EUserItemStatus"

class StatusBodyDto {
  @ApiProperty({ enum: EUserItemStatus })
  @IsEnum(EUserItemStatus)
  status: EUserItemStatus
}

export { StatusBodyDto }
