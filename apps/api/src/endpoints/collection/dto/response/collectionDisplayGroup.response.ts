import { ApiProperty } from "@nestjs/swagger"

import { GroupBlockResponseDto } from "./groupBlock.response"

class CollectionDisplayGroupResponseDto extends GroupBlockResponseDto {
  @ApiProperty({ type: String })
  beforeItemId: string
}

export { CollectionDisplayGroupResponseDto }
