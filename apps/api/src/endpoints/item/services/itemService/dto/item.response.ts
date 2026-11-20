import {
  ApiExtraModels,
  ApiProperty,
  getSchemaPath,
  OmitType,
} from "@nestjs/swagger"

import { SWAGGER_DICTIONARY } from "@endpoints/shared/static/SWAGGER_DICTIONARY"
import { EAgeRestriction } from "@entities/item/schemas/EAgeRestriction"
import { EItemType } from "@entities/item/schemas/EItemType"
import { MediaResponseDto } from "@entities/shared/dto/response/media.response"
import { ETagGroup } from "@entities/tag/schemas/ETagGroup"
import { REGEX } from "@shared/static/REGEX"

class ItemLanguageTextResponseDto {
  @ApiProperty({ oneOf: [{ type: "string" }, { type: "null" }] })
  ru: string | null

  @ApiProperty({ oneOf: [{ type: "string" }, { type: "null" }] })
  en: string | null
}

class ItemMediaResponseDto extends OmitType(MediaResponseDto, ["language"]) {
  @ApiProperty({ oneOf: [{ type: "string" }, { type: "null" }] })
  language: string | null
}

class RelatedItemResponseDto {
  @ApiProperty({ type: String, pattern: REGEX.MONGO_OBJECT_ID.source })
  id: string

  @ApiProperty({ enum: EItemType })
  type: EItemType

  @ApiProperty({ type: ItemLanguageTextResponseDto })
  title: ItemLanguageTextResponseDto

  @ApiProperty({ type: [ItemMediaResponseDto] })
  media: ItemMediaResponseDto[]
}

class ItemTagResponseDto {
  @ApiProperty({ type: String, pattern: REGEX.MONGO_OBJECT_ID.source })
  id: string

  @ApiProperty({ type: String })
  key: string

  @ApiProperty({
    oneOf: [
      { type: "string", enum: Object.values(ETagGroup) },
      { type: "null" },
    ],
  })
  group: ETagGroup | null

  @ApiProperty({ type: ItemLanguageTextResponseDto })
  name: ItemLanguageTextResponseDto
}

class ItemRelationRoleResponseDto {
  @ApiProperty({ type: String, pattern: REGEX.MONGO_OBJECT_ID.source })
  id: string

  @ApiProperty({ type: String })
  key: string

  @ApiProperty({
    type: ItemLanguageTextResponseDto,
    description: SWAGGER_DICTIONARY.item.roleName,
  })
  name: ItemLanguageTextResponseDto
}

class ItemRelationResponseDto {
  @ApiProperty({ type: RelatedItemResponseDto })
  item: RelatedItemResponseDto

  @ApiProperty({
    type: ItemRelationRoleResponseDto,
    description: SWAGGER_DICTIONARY.item.relatedRole,
  })
  role: ItemRelationRoleResponseDto
}

class ItemMovieResponseDto {
  @ApiProperty({ oneOf: [{ type: "number" }, { type: "null" }] })
  duration: number | null
}

class ItemSeriesResponseDto {
  @ApiProperty({ oneOf: [{ type: "integer", minimum: 1 }, { type: "null" }] })
  episodeCount: number | null

  @ApiProperty({ oneOf: [{ type: "integer", minimum: 0 }, { type: "null" }] })
  releasedEpisodeCount: number | null

  @ApiProperty({ oneOf: [{ type: "number" }, { type: "null" }] })
  episodeDuration: number | null

  @ApiProperty({
    oneOf: [{ type: "string", format: "date-time" }, { type: "null" }],
  })
  lastReleasedEpisodeAt: string | null

  @ApiProperty({
    oneOf: [{ type: "string", format: "date-time" }, { type: "null" }],
  })
  nextEpisodeAt: string | null
}

class ItemGameResponseDto {
  @ApiProperty({ oneOf: [{ type: "number" }, { type: "null" }] })
  mainStoryDuration: number | null

  @ApiProperty({ oneOf: [{ type: "number" }, { type: "null" }] })
  fullCompletionDuration: number | null
}

class ItemStatusCountsResponseDto {
  @ApiProperty({ type: "integer", minimum: 0 })
  planned: number

  @ApiProperty({ type: "integer", minimum: 0 })
  inProgress: number

  @ApiProperty({ type: "integer", minimum: 0 })
  onHold: number

  @ApiProperty({ type: "integer", minimum: 0 })
  completed: number

  @ApiProperty({ type: "integer", minimum: 0 })
  dropped: number
}

class ItemStatsResponseDto {
  @ApiProperty({
    oneOf: [{ type: "number", minimum: 1, maximum: 10 }, { type: "null" }],
  })
  ratingAverage: number | null

  @ApiProperty({ type: "integer", minimum: 0 })
  ratingsCount: number

  @ApiProperty({ type: "integer", minimum: 0 })
  favoritesCount: number

  @ApiProperty({ type: ItemStatusCountsResponseDto })
  statusCounts: ItemStatusCountsResponseDto
}

@ApiExtraModels(
  ItemMovieResponseDto,
  ItemSeriesResponseDto,
  ItemGameResponseDto,
)
class ItemResponseDto extends RelatedItemResponseDto {
  @ApiProperty({ type: ItemLanguageTextResponseDto })
  description: ItemLanguageTextResponseDto

  @ApiProperty({ type: [String] })
  aliases: string[]

  @ApiProperty({
    type: [ItemTagResponseDto],
    description: SWAGGER_DICTIONARY.item.tagsOrder,
  })
  tags: ItemTagResponseDto[]

  @ApiProperty({
    type: [ItemRelationResponseDto],
    description: SWAGGER_DICTIONARY.item.relationsOrder,
  })
  relations: ItemRelationResponseDto[]

  @ApiProperty({
    type: ItemStatsResponseDto,
    description: SWAGGER_DICTIONARY.item.stats,
  })
  stats: ItemStatsResponseDto

  @ApiProperty({
    oneOf: [{ type: "string", format: "date-time" }, { type: "null" }],
  })
  releaseDate: string | null

  @ApiProperty({
    oneOf: [
      { type: "string", enum: Object.values(EAgeRestriction) },
      { type: "null" },
    ],
  })
  ageRestriction: EAgeRestriction | null

  @ApiProperty({
    oneOf: [{ $ref: getSchemaPath(ItemMovieResponseDto) }, { type: "null" }],
  })
  movie: ItemMovieResponseDto | null

  @ApiProperty({
    oneOf: [{ $ref: getSchemaPath(ItemSeriesResponseDto) }, { type: "null" }],
  })
  series: ItemSeriesResponseDto | null

  @ApiProperty({
    oneOf: [{ $ref: getSchemaPath(ItemGameResponseDto) }, { type: "null" }],
  })
  game: ItemGameResponseDto | null
}

export { ItemResponseDto }
