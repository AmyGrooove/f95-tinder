import { ApiProperty } from "@nestjs/swagger"

import { EItemFieldValueType } from "@entities/item/schemas/EItemFieldValueType"

import { CollectionFilterFieldResponseDto } from "./collectionFilterField.response"

class CollectionFilterNumberResponseDto extends CollectionFilterFieldResponseDto {
  @ApiProperty({ enum: [EItemFieldValueType.NUMBER] })
  valueType: EItemFieldValueType.NUMBER

  @ApiProperty({ type: Number })
  min: number

  @ApiProperty({ type: Number })
  max: number
}

export { CollectionFilterNumberResponseDto }
