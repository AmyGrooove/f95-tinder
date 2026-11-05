import { ApiProperty } from "@nestjs/swagger"

import { ETagGroup } from "@entities/tag/schemas/ETagGroup"
import { LanguageTextResponseDto } from "@entities/shared/dto/response/languageText.response"

class CollectionFilterTagResponseDto {
  @ApiProperty({ type: String })
  id: string

  @ApiProperty({ type: String })
  key: string

  @ApiProperty({ enum: ETagGroup, nullable: true })
  group: ETagGroup | null

  @ApiProperty({ type: LanguageTextResponseDto })
  name: LanguageTextResponseDto
}

export { CollectionFilterTagResponseDto }
