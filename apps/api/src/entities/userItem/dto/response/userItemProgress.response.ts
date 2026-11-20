import { ApiProperty } from "@nestjs/swagger"

import { EUnit } from "@entities/shared/schemas/EUnit"

class UserItemProgressResponseDto {
  @ApiProperty({
    type: "integer",
    minimum: 0,
    maximum: Number.MAX_SAFE_INTEGER,
  })
  value: number

  @ApiProperty({ enum: [EUnit.MINUTE, EUnit.EPISODE, EUnit.PERCENT] })
  unit: EUnit.MINUTE | EUnit.EPISODE | EUnit.PERCENT
}

export { UserItemProgressResponseDto }
