import { ApiProperty } from "@nestjs/swagger"
import { IsMongoId } from "class-validator"

class SessionParamsDto {
  @ApiProperty({
    description: "Идентификатор собственной сессии",
    type: String,
    pattern: "^[a-fA-F0-9]{24}$",
  })
  @IsMongoId()
  sessionId: string
}

export { SessionParamsDto }
