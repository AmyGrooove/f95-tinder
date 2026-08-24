import { ApiProperty, ApiSchema } from "@nestjs/swagger"
import { IsMongoId } from "class-validator"

@ApiSchema({ name: "LibraryGameIdParams" })
class LibraryGameIdParamsDto {
  @ApiProperty({ description: "Game identifier" })
  @IsMongoId()
  gameId!: string
}

export { LibraryGameIdParamsDto }
