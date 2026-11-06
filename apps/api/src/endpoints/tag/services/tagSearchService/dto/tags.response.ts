import { ApiProperty } from "@nestjs/swagger"

import { LanguageTextResponseDto } from "@entities/shared/dto/response/languageText.response"
import { ETagGroup } from "@entities/tag/schemas/ETagGroup"

class TagResponseDto {
  @ApiProperty({ type: String })
  id: string

  @ApiProperty({ type: String })
  key: string

  @ApiProperty({ enum: ETagGroup, nullable: true })
  group: ETagGroup | null

  @ApiProperty({ type: LanguageTextResponseDto })
  name: LanguageTextResponseDto
}

class TagsResponseDto {
  @ApiProperty({ type: [TagResponseDto] })
  items: TagResponseDto[]

  @ApiProperty({ type: String, nullable: true })
  nextCursor: string | null
}

export { TagsResponseDto }
