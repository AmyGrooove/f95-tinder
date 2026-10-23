import { ApiProperty } from "@nestjs/swagger"

import { EFeatureValueType } from "@entities/feature/schemas/EFeatureValueType"

import { CollectionFilterFeatureResponseDto } from "./collectionFilterFeature.response"

class CollectionFilterNumberResponseDto extends CollectionFilterFeatureResponseDto {
  @ApiProperty({ enum: [EFeatureValueType.NUMBER] })
  valueType: EFeatureValueType.NUMBER

  @ApiProperty({ type: Number })
  min: number

  @ApiProperty({ type: Number })
  max: number
}

export { CollectionFilterNumberResponseDto }
