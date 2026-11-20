import {
  ApiPropertyOptional,
  IntersectionType,
  PickType,
} from "@nestjs/swagger"
import { Type } from "class-transformer"
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsMongoId,
  IsNumber,
  IsObject,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from "class-validator"

import { SWAGGER_DICTIONARY } from "@endpoints/shared/static/SWAGGER_DICTIONARY"
import { ECollectionType } from "@entities/collection/schemas/ECollectionType"
import { EItemField } from "@entities/item/schemas/EItemField"
import { ValueFilterProperty } from "@entities/shared/decorators/ValueFilterProperty"
import { RatingRangeDto } from "@entities/shared/dto/body/ratingRange.body"
import { QueryFieldsDto } from "@entities/shared/dto/query/queryFields.dto"
import { createSortDto } from "@entities/shared/functions/createSortDto"
import { ESort } from "@entities/shared/types/ESort"
import type { ValueFilter } from "@entities/shared/types/ValueFilter"
import { ETagGroup } from "@entities/tag/schemas/ETagGroup"
import { isUndefined } from "@shared/functions/checks/isUndefined"
import { REGEX } from "@shared/static/REGEX"

const isProvided = (_object: unknown, value: unknown) => !isUndefined(value)
const DURATION_FIELDS = [
  EItemField.DURATION,
  EItemField.EPISODE_DURATION,
  EItemField.MAIN_STORY_DURATION,
  EItemField.FULL_COMPLETION_DURATION,
] as const
const COLLECTION_SOURCES = ["site", "user"] as const

class ReleaseYearRangeDto {
  @ApiPropertyOptional({ type: "integer", minimum: 1, maximum: 9999 })
  @ValidateIf(isProvided)
  @IsInt()
  @Min(1)
  @Max(9999)
  min?: number

  @ApiPropertyOptional({ type: "integer", minimum: 1, maximum: 9999 })
  @ValidateIf(isProvided)
  @IsInt()
  @Min(1)
  @Max(9999)
  max?: number
}

class DurationRangeDto {
  @ApiPropertyOptional({
    type: String,
    enum: DURATION_FIELDS,
    default: EItemField.DURATION,
  })
  @ValidateIf(isProvided)
  @IsIn(DURATION_FIELDS)
  field?: (typeof DURATION_FIELDS)[number]

  @ApiPropertyOptional({ type: Number, minimum: 0 })
  @ValidateIf(isProvided)
  @IsNumber()
  @Min(0)
  min?: number

  @ApiPropertyOptional({ type: Number, minimum: 0 })
  @ValidateIf(isProvided)
  @IsNumber()
  @Min(0)
  max?: number
}

class SearchItemsBodyDto extends IntersectionType(
  PickType(QueryFieldsDto, ["types", "rating", "statuses"]),
  createSortDto([
    ESort.RELEVANCE,
    ESort.TITLE,
    ESort.RELEASE_DATE,
    ESort.LATEST_RELEASE_DATE,
    ESort.RATING,
  ]),
) {
  @ValueFilterProperty({})
  tags?: ValueFilter<string>

  @ValueFilterProperty({
    description: "ID тегов стран производства из группы country",
  })
  countries?: ValueFilter<string>

  @ValueFilterProperty({
    description: "ID тегов статуса выпуска из группы releaseStatus",
  })
  releaseStatuses?: ValueFilter<string>

  @ApiPropertyOptional({ type: ReleaseYearRangeDto })
  @ValidateIf(isProvided)
  @IsObject()
  @Type(() => ReleaseYearRangeDto)
  @ValidateNested()
  releaseYear?: ReleaseYearRangeDto

  @ApiPropertyOptional({
    type: DurationRangeDto,
    description: "Продолжительность в минутах",
  })
  @ValidateIf(isProvided)
  @IsObject()
  @Type(() => DurationRangeDto)
  @ValidateNested()
  duration?: DurationRangeDto

  @ApiPropertyOptional({
    type: Boolean,
    description: "Наличие записи UserItem зрителя, включая skipped и blocked",
  })
  @ValidateIf(isProvided)
  @IsBoolean()
  isUserItemPresent?: boolean

  @ApiPropertyOptional({
    type: Boolean,
    description: "При true оставить только избранные произведения зрителя",
  })
  @ValidateIf(isProvided)
  @IsBoolean()
  isFavorite?: boolean

  @ApiPropertyOptional({
    type: RatingRangeDto,
    description: "Диапазон личной оценки зрителя",
  })
  @ValidateIf(isProvided)
  @IsObject()
  @Type(() => RatingRangeDto)
  @ValidateNested()
  userRating?: RatingRangeDto

  @ApiPropertyOptional({
    type: Boolean,
    description: "Скрыть завершённые и брошенные произведения зрителя",
  })
  @ValidateIf(isProvided)
  @IsBoolean()
  isCompletedOrDroppedExcluded?: boolean

  @ApiPropertyOptional({
    type: Boolean,
    description: "Скрыть произведения с отметкой зрителя «Не рекомендовать»",
  })
  @ValidateIf(isProvided)
  @IsBoolean()
  isBlockedExcluded?: boolean
}

class SearchCollectionsBodyDto extends createSortDto([
  ESort.RELEVANCE,
  ESort.TITLE,
  ESort.UPDATED_AT,
  ESort.RATING,
]) {
  @ApiPropertyOptional({
    type: String,
    pattern: REGEX.MONGO_OBJECT_ID.source,
    description: SWAGGER_DICTIONARY.search.collectionItemId,
  })
  @ValidateIf(isProvided)
  @IsMongoId()
  itemId?: string

  @ApiPropertyOptional({
    type: String,
    pattern: REGEX.MONGO_OBJECT_ID.source,
    description: SWAGGER_DICTIONARY.search.collectionAuthorId,
  })
  @ValidateIf(isProvided)
  @IsMongoId()
  authorId?: string

  @ApiPropertyOptional({
    type: String,
    pattern: REGEX.MONGO_OBJECT_ID.source,
    description: SWAGGER_DICTIONARY.search.collectionFavoritedByUserId,
  })
  @ValidateIf(isProvided)
  @IsMongoId()
  favoritedByUserId?: string

  @ValueFilterProperty({ values: Object.values(ECollectionType) })
  collectionTypes?: ValueFilter<ECollectionType>

  @ValueFilterProperty({
    values: Object.values(ETagGroup),
    description: SWAGGER_DICTIONARY.search.collectionTagGroups,
  })
  tagGroups?: ValueFilter<ETagGroup>

  @ApiPropertyOptional({ enum: COLLECTION_SOURCES, type: String })
  @ValidateIf(isProvided)
  @IsIn(COLLECTION_SOURCES)
  source?: (typeof COLLECTION_SOURCES)[number]

  @ApiPropertyOptional({
    type: Boolean,
    description: "При true оставить только коллекции зрителя",
  })
  @ValidateIf(isProvided)
  @IsBoolean()
  isMine?: boolean

  @ApiPropertyOptional({
    type: Boolean,
    description: "При true оставить только избранные коллекции зрителя",
  })
  @ValidateIf(isProvided)
  @IsBoolean()
  isFavorite?: boolean

  @ApiPropertyOptional({
    type: Boolean,
    description: "Исключить коллекции, скрытые зрителем",
  })
  @ValidateIf(isProvided)
  @IsBoolean()
  isHiddenExcluded?: boolean
}

class SearchUsersBodyDto extends createSortDto([
  ESort.RELEVANCE,
  ESort.DISPLAY_NAME,
]) {}

export { SearchCollectionsBodyDto, SearchItemsBodyDto, SearchUsersBodyDto }
