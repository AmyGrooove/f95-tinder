import { ApiProperty } from "@nestjs/swagger"

import { TextBlockResponseDto } from "./textBlock.response"

class CollectionDisplayTextResponseDto extends TextBlockResponseDto {
  @ApiProperty({ type: String, nullable: true })
  beforeItemId: string | null
}

export { CollectionDisplayTextResponseDto }
