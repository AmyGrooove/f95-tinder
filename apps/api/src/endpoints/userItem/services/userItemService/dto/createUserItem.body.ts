import { REGEX } from "@shared/static/REGEX"
import { ApiProperty } from "@nestjs/swagger"
import { IsMongoId } from "class-validator"

import { StatusBodyDto } from "./status.body"

class CreateUserItemBodyDto extends StatusBodyDto {
  @ApiProperty({ type: String, pattern: REGEX.MONGO_OBJECT_ID.source })
  @IsMongoId()
  itemId: string
}

export { CreateUserItemBodyDto }
