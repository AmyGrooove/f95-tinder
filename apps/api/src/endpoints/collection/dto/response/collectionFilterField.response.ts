import { ApiProperty } from "@nestjs/swagger"
import { EItemField } from "@entities/item/schemas/EItemField"
import { EUnit } from "@entities/shared/schemas/EUnit"
import { LanguageTextResponseDto } from "@entities/shared/dto/response/languageText.response"

class CollectionFilterFieldResponseDto {
  @ApiProperty({ enum: EItemField })
  field: EItemField

  @ApiProperty({ type: LanguageTextResponseDto })
  name: LanguageTextResponseDto

  @ApiProperty({ enum: EUnit, nullable: true })
  unit: EUnit | null
}

export { CollectionFilterFieldResponseDto }
