import {
  ApiExtraModels,
  ApiProperty,
  ApiPropertyOptional,
  getSchemaPath,
  PickType,
} from "@nestjs/swagger"
import { LanguageTextResponseDto } from "@entities/shared/dto/response/languageText.response"
import { USER_ITEM_LIBRARY_STATUSES } from "@entities/userItem/static/USER_ITEM_LIBRARY_STATUSES"
import { UserItemProgressResponseDto } from "@entities/userItem/dto/response/userItemProgress.response"
import type { TLibraryStatus } from "@entities/userItem/types/TLibraryStatus"
import { SWAGGER_DICTIONARY } from "@endpoints/shared/static/SWAGGER_DICTIONARY"
import {
  GroupBlockResponseDto,
  TextBlockResponseDto,
} from "@endpoints/collection/services/collectionService"
import { ItemCollectionResponseDto } from "./itemCollection.response"

class CollectionGroupItemResponseDto extends PickType(
  ItemCollectionResponseDto,
  ["id", "type", "title", "media"] as const,
) {
  @ApiProperty({ type: String, nullable: true })
  note: string | null

  @ApiProperty({
    type: Number,
    nullable: true,
    description: SWAGGER_DICTIONARY.collection.itemsRatingAverage,
  })
  ratingAverage: number | null

  @ApiProperty({
    type: "integer",
    minimum: 1,
    maximum: 10,
    nullable: true,
    description: SWAGGER_DICTIONARY.collection.itemsUserRating,
  })
  userRating: number | null

  @ApiProperty({
    enum: USER_ITEM_LIBRARY_STATUSES,
    nullable: true,
    description: SWAGGER_DICTIONARY.collection.itemsUserStatus,
  })
  userStatus: TLibraryStatus | null

  @ApiProperty({
    type: UserItemProgressResponseDto,
    nullable: true,
    description: SWAGGER_DICTIONARY.collection.itemsUserProgress,
  })
  userProgress: UserItemProgressResponseDto | null
}

class CollectionItemsMetadataResponseDto {
  @ApiProperty({ type: LanguageTextResponseDto })
  label: LanguageTextResponseDto

  @ApiProperty({ type: LanguageTextResponseDto })
  description: LanguageTextResponseDto
}

class CollectionItemsGroupResponseDto extends PickType(GroupBlockResponseDto, [
  "id",
  "type",
  "title",
  "description",
] as const) {
  @ApiProperty({ type: [CollectionGroupItemResponseDto] })
  items: CollectionGroupItemResponseDto[]
}

class CollectionItemsTextResponseDto extends PickType(TextBlockResponseDto, [
  "type",
  "content",
] as const) {}

@ApiExtraModels(CollectionItemsGroupResponseDto, CollectionItemsTextResponseDto)
class ItemCollectionsResponseDto {
  @ApiProperty({ type: String, nullable: true })
  nextCursor: string | null

  @ApiProperty({
    type: "array",
    items: {
      oneOf: [
        { $ref: getSchemaPath(CollectionItemsGroupResponseDto) },
        { $ref: getSchemaPath(CollectionItemsTextResponseDto) },
      ],
    },
  })
  blocks: (CollectionItemsGroupResponseDto | CollectionItemsTextResponseDto)[]

  @ApiPropertyOptional({ type: [CollectionGroupItemResponseDto] })
  items?: CollectionGroupItemResponseDto[]

  @ApiPropertyOptional({
    type: CollectionItemsMetadataResponseDto,
    description: SWAGGER_DICTIONARY.collection.itemsMetadata,
  })
  metadata?: CollectionItemsMetadataResponseDto

  @ApiProperty({
    type: Boolean,
    description: SWAGGER_DICTIONARY.collection.itemsHidden,
  })
  isHidden: boolean
}

export { CollectionGroupItemResponseDto, ItemCollectionsResponseDto }
