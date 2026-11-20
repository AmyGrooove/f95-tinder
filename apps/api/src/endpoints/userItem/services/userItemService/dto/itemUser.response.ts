import {
  ApiExtraModels,
  ApiProperty,
  getSchemaPath,
  PickType,
} from "@nestjs/swagger"

import { SWAGGER_DICTIONARY } from "@endpoints/shared/static/SWAGGER_DICTIONARY"
import { REGEX } from "@shared/static/REGEX"

import { UserItemResponseDto } from "./userItem.response"

class ItemUserEntryResponseDto extends PickType(UserItemResponseDto, [
  "status",
  "rating",
  "isFavorite",
  "note",
  "attempts",
] as const) {
  @ApiProperty({ type: String, pattern: REGEX.MONGO_OBJECT_ID.source })
  userItemId: string
}

@ApiExtraModels(ItemUserEntryResponseDto)
class ItemUserResponseDto {
  @ApiProperty({
    oneOf: [
      { $ref: getSchemaPath(ItemUserEntryResponseDto) },
      { type: "null" },
    ],
    description: SWAGGER_DICTIONARY.item.userEntry,
  })
  entry: ItemUserEntryResponseDto | null
}

export { ItemUserResponseDto }
