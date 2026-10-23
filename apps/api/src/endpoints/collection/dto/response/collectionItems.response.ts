import { ApiExtraModels, ApiProperty, getSchemaPath } from "@nestjs/swagger"

import type { IPaginatedResult } from "@infrastructure/database/types/IPaginatedResult"

import { ECollectionMode } from "../../types/ECollectionMode"
import { CollectionItemResponseDto } from "./collectionItem.response"
import { CollectionDisplayGroupResponseDto } from "./collectionDisplayGroup.response"
import { CollectionDisplayTextResponseDto } from "./collectionDisplayText.response"

@ApiExtraModels(
  CollectionDisplayGroupResponseDto,
  CollectionDisplayTextResponseDto,
)
class CollectionItemsResponseDto implements IPaginatedResult<CollectionItemResponseDto> {
  @ApiProperty({ type: [CollectionItemResponseDto] })
  items: CollectionItemResponseDto[]

  @ApiProperty({ type: Number, minimum: 1 })
  page: number

  @ApiProperty({ type: Number, minimum: 1, maximum: 100 })
  limit: number

  @ApiProperty({ type: Number, minimum: 0 })
  total: number

  @ApiProperty({ type: Number, minimum: 0 })
  pages: number

  @ApiProperty({ type: Boolean })
  isNextPage: boolean

  @ApiProperty({ type: Boolean })
  isPreviousPage: boolean

  @ApiProperty({ enum: ECollectionMode })
  mode: ECollectionMode

  @ApiProperty({
    type: "array",
    items: {
      oneOf: [
        { $ref: getSchemaPath(CollectionDisplayGroupResponseDto) },
        { $ref: getSchemaPath(CollectionDisplayTextResponseDto) },
      ],
      discriminator: {
        propertyName: "type",
        mapping: {
          group: getSchemaPath(CollectionDisplayGroupResponseDto),
          text: getSchemaPath(CollectionDisplayTextResponseDto),
        },
      },
    },
  })
  displayBlocks: (
    CollectionDisplayGroupResponseDto | CollectionDisplayTextResponseDto
  )[]
}

export { CollectionItemsResponseDto }
