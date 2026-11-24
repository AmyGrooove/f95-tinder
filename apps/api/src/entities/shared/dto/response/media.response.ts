import { ApiProperty } from "@nestjs/swagger"

import { CATALOG_MEDIA_TYPES } from "../../schemas/EMediaType"
import type { EMediaType } from "../../schemas/EMediaType"

class MediaResponseDto {
  @ApiProperty({ type: String })
  src: string

  @ApiProperty({ type: String, nullable: true })
  language: string | null

  @ApiProperty({ enum: CATALOG_MEDIA_TYPES })
  type: EMediaType
}

export { MediaResponseDto }
