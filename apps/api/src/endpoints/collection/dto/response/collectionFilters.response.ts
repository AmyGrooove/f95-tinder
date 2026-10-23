import { ApiExtraModels, ApiProperty, getSchemaPath } from "@nestjs/swagger"

import { CollectionFilterTagResponseDto } from "./collectionFilterTag.response"
import { CollectionFilterNumberResponseDto } from "./collectionFilterNumber.response"
import { CollectionFilterDateResponseDto } from "./collectionFilterDate.response"
import { CollectionFilterBooleanResponseDto } from "./collectionFilterBoolean.response"
import { CollectionSortingResponseDto } from "./collectionSorting.response"

@ApiExtraModels(
  CollectionFilterNumberResponseDto,
  CollectionFilterDateResponseDto,
  CollectionFilterBooleanResponseDto,
)
class CollectionFiltersResponseDto {
  @ApiProperty({ type: [CollectionFilterTagResponseDto] })
  tags: CollectionFilterTagResponseDto[]

  @ApiProperty({
    type: "array",
    items: {
      oneOf: [
        { $ref: getSchemaPath(CollectionFilterNumberResponseDto) },
        { $ref: getSchemaPath(CollectionFilterDateResponseDto) },
        { $ref: getSchemaPath(CollectionFilterBooleanResponseDto) },
      ],
      discriminator: {
        propertyName: "valueType",
        mapping: {
          number: getSchemaPath(CollectionFilterNumberResponseDto),
          date: getSchemaPath(CollectionFilterDateResponseDto),
          boolean: getSchemaPath(CollectionFilterBooleanResponseDto),
        },
      },
    },
  })
  features: (
    | CollectionFilterNumberResponseDto
    | CollectionFilterDateResponseDto
    | CollectionFilterBooleanResponseDto
  )[]

  @ApiProperty({ type: CollectionSortingResponseDto })
  sorting: CollectionSortingResponseDto
}

export { CollectionFiltersResponseDto }
