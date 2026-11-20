import { ApiProperty } from "@nestjs/swagger"

class UserCollectionProgressResponseDto {
  @ApiProperty({ type: "integer", minimum: 0 })
  completed: number

  @ApiProperty({ type: "integer", minimum: 0 })
  total: number
}

class UserCollectionResponseDto {
  @ApiProperty({ type: Boolean })
  isFavorite: boolean

  @ApiProperty({ type: Number, minimum: 1, maximum: 10, nullable: true })
  rating: number | null

  @ApiProperty({ type: Boolean })
  isHidden: boolean

  @ApiProperty({ type: UserCollectionProgressResponseDto })
  progress: UserCollectionProgressResponseDto
}

export { UserCollectionResponseDto }
