import { REGEX } from "@shared/static/REGEX"
import { ApiProperty } from "@nestjs/swagger"
import { IsMongoId } from "class-validator"

class CreateExclusionBodyDto {
  @ApiProperty({ type: String, pattern: REGEX.MONGO_OBJECT_ID.source })
  @IsMongoId()
  itemId: string
}

export { CreateExclusionBodyDto }
