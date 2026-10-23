import { ApiProperty } from "@nestjs/swagger"

import { EFeatureValueType } from "@entities/feature/schemas/EFeatureValueType"

import { CollectionFilterFeatureResponseDto } from "./collectionFilterFeature.response"

class CollectionFilterBooleanResponseDto extends CollectionFilterFeatureResponseDto {
  @ApiProperty({ enum: [EFeatureValueType.BOOLEAN] })
  valueType: EFeatureValueType.BOOLEAN

  @ApiProperty({ type: [Boolean], uniqueItems: true })
  values: boolean[]
}

export { CollectionFilterBooleanResponseDto }
