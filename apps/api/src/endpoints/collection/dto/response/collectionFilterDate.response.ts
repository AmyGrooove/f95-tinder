import { ApiProperty } from "@nestjs/swagger"

import { EFeatureValueType } from "@entities/feature/schemas/EFeatureValueType"

import { CollectionFilterFeatureResponseDto } from "./collectionFilterFeature.response"

class CollectionFilterDateResponseDto extends CollectionFilterFeatureResponseDto {
  @ApiProperty({ enum: [EFeatureValueType.DATE] })
  valueType: EFeatureValueType.DATE

  @ApiProperty({ type: String, format: "date-time" })
  min: string

  @ApiProperty({ type: String, format: "date-time" })
  max: string
}

export { CollectionFilterDateResponseDto }
