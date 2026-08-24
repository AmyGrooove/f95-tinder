import { ApiProperty, ApiPropertyOptional, ApiSchema } from "@nestjs/swagger"

@ApiSchema({ name: "TagResponse" })
class TagResponseDto {
  @ApiProperty()
  id!: string

  @ApiProperty()
  f95TagId!: number

  @ApiProperty()
  name!: string

  @ApiProperty()
  slug!: string
}

@ApiSchema({ name: "PrefixResponse" })
class PrefixResponseDto {
  @ApiProperty()
  id!: string

  @ApiProperty()
  f95PrefixId!: number

  @ApiProperty()
  name!: string

  @ApiProperty()
  group!: string

  @ApiProperty()
  slug!: string
}

@ApiSchema({ name: "CreatorResponse" })
class CreatorResponseDto {
  @ApiProperty()
  id!: string

  @ApiProperty()
  name!: string

  @ApiProperty()
  slug!: string
}

@ApiSchema({ name: "GameResponse" })
class GameResponseDto {
  @ApiProperty()
  id!: string

  @ApiProperty()
  f95ThreadId!: number

  @ApiProperty()
  threadUrl!: string

  @ApiProperty()
  title!: string

  @ApiProperty()
  creatorId!: string

  @ApiProperty()
  version!: string

  @ApiPropertyOptional({ nullable: true })
  coverUrl!: string | null

  @ApiProperty({ type: [String] })
  screenshotUrls!: string[]

  @ApiPropertyOptional({ nullable: true })
  f95UpdatedAt!: Date | null

  @ApiProperty({ type: [String] })
  tagIds!: string[]

  @ApiProperty({ type: [String] })
  prefixIds!: string[]

  @ApiProperty()
  createdAt!: Date

  @ApiProperty()
  updatedAt!: Date
}

@ApiSchema({ name: "GameListResponse" })
class GameListResponseDto {
  @ApiProperty({ type: [GameResponseDto] })
  items!: GameResponseDto[]

  @ApiProperty()
  count!: number

  @ApiPropertyOptional({ nullable: true })
  nextCursor!: string | null
}

@ApiSchema({ name: "TagListResponse" })
class TagListResponseDto {
  @ApiProperty({ type: [TagResponseDto] })
  items!: TagResponseDto[]

  @ApiProperty()
  count!: number

  @ApiPropertyOptional({ nullable: true })
  nextCursor!: string | null
}

@ApiSchema({ name: "PrefixListResponse" })
class PrefixListResponseDto {
  @ApiProperty({ type: [PrefixResponseDto] })
  items!: PrefixResponseDto[]

  @ApiProperty()
  count!: number

  @ApiPropertyOptional({ nullable: true })
  nextCursor!: string | null
}

@ApiSchema({ name: "CreatorListResponse" })
class CreatorListResponseDto {
  @ApiProperty({ type: [CreatorResponseDto] })
  items!: CreatorResponseDto[]

  @ApiProperty()
  count!: number

  @ApiPropertyOptional({ nullable: true })
  nextCursor!: string | null
}

export {
  CreatorListResponseDto,
  CreatorResponseDto,
  GameListResponseDto,
  GameResponseDto,
  PrefixListResponseDto,
  PrefixResponseDto,
  TagListResponseDto,
  TagResponseDto,
}
