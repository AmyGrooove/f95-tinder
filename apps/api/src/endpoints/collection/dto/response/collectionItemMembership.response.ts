import { ApiProperty } from "@nestjs/swagger"

class CollectionItemMembershipResponseDto {
  @ApiProperty({ type: String })
  groupId: string

  @ApiProperty({ type: Number, minimum: 0, maximum: Number.MAX_SAFE_INTEGER })
  position: number

  @ApiProperty({ type: String, nullable: true })
  note: string | null
}

export { CollectionItemMembershipResponseDto }
