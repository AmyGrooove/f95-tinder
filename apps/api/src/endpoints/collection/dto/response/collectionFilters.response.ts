import { ApiExtraModels, ApiProperty, getSchemaPath } from "@nestjs/swagger"

import { CollectionFilterTagResponseDto } from "./collectionFilterTag.response"
import { CollectionFilterNumberResponseDto } from "./collectionFilterNumber.response"
import { CollectionFilterDateResponseDto } from "./collectionFilterDate.response"
import { CollectionSortingResponseDto } from "./collectionSorting.response"

@ApiExtraModels(
  CollectionFilterNumberResponseDto,
  CollectionFilterDateResponseDto,
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
      ],
      discriminator: {
        propertyName: "valueType",
        mapping: {
          number: getSchemaPath(CollectionFilterNumberResponseDto),
          date: getSchemaPath(CollectionFilterDateResponseDto),
        },
      },
    },
  })
  fields: (
    CollectionFilterNumberResponseDto | CollectionFilterDateResponseDto
  )[]

  @ApiProperty({ type: CollectionSortingResponseDto })
  sorting: CollectionSortingResponseDto
}

export { CollectionFiltersResponseDto }
