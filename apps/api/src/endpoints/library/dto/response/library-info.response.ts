import { ApiProperty, ApiSchema } from "@nestjs/swagger"

import { GameResponseDto } from "../../../games/dto/response/game-list.response"

@ApiSchema({ name: "LibraryInfoResponse" })
class LibraryInfoResponseDto {
  @ApiProperty()
  total!: number

  @ApiProperty()
  favorites!: number

  @ApiProperty()
  trash!: number

  @ApiProperty()
  played!: number
}

@ApiSchema({ name: "LibraryGameListResponse" })
class LibraryGameListResponseDto {
  @ApiProperty({ type: [GameResponseDto] })
  items!: GameResponseDto[]

  @ApiProperty()
  count!: number

  @ApiProperty({ nullable: true })
  nextCursor!: string | null
}

@ApiSchema({ name: "LibraryGameStateResponse" })
class LibraryGameStateResponseDto {
  @ApiProperty()
  id!: string

  @ApiProperty()
  userId!: string

  @ApiProperty()
  gameId!: string

  @ApiProperty()
  listType!: string

  @ApiProperty()
  createdAt!: Date

  @ApiProperty()
  updatedAt!: Date
}

export {
  LibraryGameListResponseDto,
  LibraryGameStateResponseDto,
  LibraryInfoResponseDto,
}
