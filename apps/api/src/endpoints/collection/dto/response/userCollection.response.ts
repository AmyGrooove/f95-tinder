import { ApiProperty } from "@nestjs/swagger"

class UserCollectionResponseDto {
  @ApiProperty({ type: Boolean })
  isFavorite: boolean

  @ApiProperty({ type: Number, minimum: 1, maximum: 10, nullable: true })
  rating: number | null

  @ApiProperty({ type: Boolean })
  isHidden: boolean
}

export { UserCollectionResponseDto }
