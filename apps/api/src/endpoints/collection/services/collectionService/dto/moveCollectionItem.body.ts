import { ApiProperty } from "@nestjs/swagger"
import { IsMongoId, ValidateIf } from "class-validator"

class MoveCollectionItemBodyDto {
  @ApiProperty({ type: String })
  @IsMongoId()
  itemId: string

  @ApiProperty({ type: String })
  @IsMongoId()
  groupId: string

  @ApiProperty({ type: String, nullable: true })
  @ValidateIf((_object: unknown, value: unknown) => value !== null)
  @IsMongoId()
  beforeItemId: string | null
}

export { MoveCollectionItemBodyDto }
