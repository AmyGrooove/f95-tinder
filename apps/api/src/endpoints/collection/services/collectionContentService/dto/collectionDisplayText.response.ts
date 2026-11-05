import { ApiProperty } from "@nestjs/swagger"

import { TextBlockResponseDto } from "@endpoints/collection/services/collectionService"

class CollectionDisplayTextResponseDto extends TextBlockResponseDto {
  @ApiProperty({ type: String, nullable: true })
  beforeItemId: string | null
}

export { CollectionDisplayTextResponseDto }
