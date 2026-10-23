import { ApiProperty } from "@nestjs/swagger"

import { EFeatureGroup } from "@entities/feature/schemas/EFeatureGroup"
import { EUnit } from "@entities/shared/schemas/EUnit"
import { LanguageTextResponseDto } from "@entities/shared/dto/response/languageText.response"

class CollectionFilterFeatureResponseDto {
  @ApiProperty({ type: String })
  id: string

  @ApiProperty({ type: String })
  key: string

  @ApiProperty({ enum: EFeatureGroup, nullable: true })
  group: EFeatureGroup | null

  @ApiProperty({ type: LanguageTextResponseDto })
  name: LanguageTextResponseDto

  @ApiProperty({ enum: EUnit, nullable: true })
  unit: EUnit | null
}

export { CollectionFilterFeatureResponseDto }
