import { ApiProperty, ApiSchema } from "@nestjs/swagger"
import { IsMongoId } from "class-validator"

@ApiSchema({ name: "SwipeGameIdParams" })
class SwipeGameIdParamsDto {
  @ApiProperty({ description: "Game identifier" })
  @IsMongoId()
  gameId!: string
}

export { SwipeGameIdParamsDto }
