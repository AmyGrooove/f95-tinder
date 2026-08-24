import { ApiProperty, ApiSchema } from "@nestjs/swagger"
import { IsMongoId } from "class-validator"

@ApiSchema({ name: "GameIdParams" })
class GameIdParamsDto {
  @ApiProperty({ description: "Game identifier" })
  @IsMongoId()
  id!: string
}

export { GameIdParamsDto }
