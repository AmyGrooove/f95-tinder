import { ApiProperty } from "@nestjs/swagger"
import { IsMongoId } from "class-validator"

import { StatusBodyDto } from "./status.body"

class CreateUserItemBodyDto extends StatusBodyDto {
  @ApiProperty({ type: String, pattern: "^[a-fA-F0-9]{24}$" })
  @IsMongoId()
  itemId: string
}

export { CreateUserItemBodyDto }
