import { ApiProperty } from "@nestjs/swagger"

import { EMediaType } from "../../schemas/EMediaType"

class MediaResponseDto {
  @ApiProperty({ type: String })
  src: string

  @ApiProperty({ type: String, nullable: true })
  language: string | null

  @ApiProperty({ enum: EMediaType })
  type: EMediaType
}

export { MediaResponseDto }
