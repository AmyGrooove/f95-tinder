import { ApiProperty } from "@nestjs/swagger"
import { IsBoolean } from "class-validator"

class FavoriteBodyDto {
  @ApiProperty({ type: Boolean })
  @IsBoolean()
  isFavorite: boolean
}

export { FavoriteBodyDto }
