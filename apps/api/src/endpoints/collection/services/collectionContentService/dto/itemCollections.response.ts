import {
  ApiExtraModels,
  ApiProperty,
  getSchemaPath,
  PickType,
} from "@nestjs/swagger"
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
}

class CollectionItemsGroupResponseDto extends PickType(GroupBlockResponseDto, [
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
  @ApiProperty({
    oneOf: [{ type: "string" }, { type: "boolean", enum: [false] }],
  })
  nextCursor: string | false

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
}

export { ItemCollectionsResponseDto }
