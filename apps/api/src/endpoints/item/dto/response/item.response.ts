import { ApiProperty } from "@nestjs/swagger"

import { EAgeRestriction } from "@entities/item/schemas/EAgeRestriction"
import { EItemType } from "@entities/item/schemas/EItemType"
import { LanguageTextResponseDto } from "@entities/shared/dto/response/languageText.response"
import { MediaResponseDto } from "@entities/shared/dto/response/media.response"
import { SWAGGER_DICTIONARY } from "@entities/shared/static/SWAGGER_DICTIONARY"
import { ETagGroup } from "@entities/tag/schemas/ETagGroup"

class ItemSummaryResponseDto {
  @ApiProperty({ type: String })
  id: string

  @ApiProperty({ enum: EItemType })
  type: EItemType

  @ApiProperty({ type: LanguageTextResponseDto })
  title: LanguageTextResponseDto

  @ApiProperty({ type: [MediaResponseDto] })
  media: MediaResponseDto[]
}

class TagItemResponseDto {
  @ApiProperty({ type: String })
  id: string

  @ApiProperty({ type: String })
  key: string

  @ApiProperty({ enum: ETagGroup, nullable: true })
  group: ETagGroup | null

  @ApiProperty({ type: LanguageTextResponseDto })
  name: LanguageTextResponseDto
}

class ItemMovieResponseDto {
  @ApiProperty({ type: Number, nullable: true })
  duration: number | null
}

class ItemSeriesResponseDto {
  @ApiProperty({ type: Number, nullable: true })
  episodeCount: number | null

  @ApiProperty({ type: Number, nullable: true })
  releasedEpisodeCount: number | null

  @ApiProperty({ type: Number, nullable: true })
  episodeDuration: number | null

  @ApiProperty({ type: String, format: "date-time", nullable: true })
  nextEpisodeAt: string | null
}

class ItemGameResponseDto {
  @ApiProperty({ type: Number, nullable: true })
  mainStoryDuration: number | null

  @ApiProperty({ type: Number, nullable: true })
  fullCompletionDuration: number | null
}

class RelationResponseDto {
  @ApiProperty({ type: String })
  id: string

  @ApiProperty({ type: String })
  key: string

  @ApiProperty({
    type: LanguageTextResponseDto,
    description: SWAGGER_DICTIONARY.item.roleName,
  })
  name: LanguageTextResponseDto
}

class ItemRelationResponseDto {
  @ApiProperty({ type: ItemSummaryResponseDto })
  item: ItemSummaryResponseDto

  @ApiProperty({
    type: RelationResponseDto,
    description: SWAGGER_DICTIONARY.item.relatedRole,
  })
  role: RelationResponseDto
}

class ItemResponseDto extends ItemSummaryResponseDto {
  @ApiProperty({ type: LanguageTextResponseDto })
  description: LanguageTextResponseDto

  @ApiProperty({ type: [String] })
  aliases: string[]

  @ApiProperty({
    type: [TagItemResponseDto],
    description: SWAGGER_DICTIONARY.item.tagsOrder,
  })
  tags: TagItemResponseDto[]

  @ApiProperty({ type: String, format: "date-time", nullable: true })
  releaseDate: string | null

  @ApiProperty({
    type: String,
    enum: Object.values(EAgeRestriction),
    nullable: true,
  })
  ageRestriction: EAgeRestriction | null

  @ApiProperty({ type: ItemMovieResponseDto, nullable: true })
  movie: ItemMovieResponseDto | null

  @ApiProperty({ type: ItemSeriesResponseDto, nullable: true })
  series: ItemSeriesResponseDto | null

  @ApiProperty({ type: ItemGameResponseDto, nullable: true })
  game: ItemGameResponseDto | null

  @ApiProperty({
    type: [ItemRelationResponseDto],
    description: SWAGGER_DICTIONARY.item.relationsOrder,
  })
  relations: ItemRelationResponseDto[]
}

export { ItemResponseDto }
