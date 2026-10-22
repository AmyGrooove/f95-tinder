import { ApiProperty } from "@nestjs/swagger"
import { IsBoolean } from "class-validator"

class HiddenBodyDto {
  @ApiProperty({ type: Boolean })
  @IsBoolean()
  isHidden: boolean
}

export { HiddenBodyDto }
