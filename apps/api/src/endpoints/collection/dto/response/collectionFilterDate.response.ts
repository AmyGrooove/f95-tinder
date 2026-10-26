import { ApiProperty } from "@nestjs/swagger"

import { EItemFieldValueType } from "@entities/item/schemas/EItemFieldValueType"

import { CollectionFilterFieldResponseDto } from "./collectionFilterField.response"

class CollectionFilterDateResponseDto extends CollectionFilterFieldResponseDto {
  @ApiProperty({ enum: [EItemFieldValueType.DATE] })
  valueType: EItemFieldValueType.DATE

  @ApiProperty({ type: String, format: "date-time" })
  min: string

  @ApiProperty({ type: String, format: "date-time" })
  max: string
}

export { CollectionFilterDateResponseDto }
