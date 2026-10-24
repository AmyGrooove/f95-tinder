import { ApiProperty } from "@nestjs/swagger"
import { IsMongoId } from "class-validator"

class CreateExclusionBodyDto {
  @ApiProperty({ type: String, pattern: "^[a-fA-F0-9]{24}$" })
  @IsMongoId()
  itemId: string
}

export { CreateExclusionBodyDto }
