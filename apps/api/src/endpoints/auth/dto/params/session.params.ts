import { ApiProperty } from "@nestjs/swagger"
import { IsMongoId } from "class-validator"
import { SWAGGER_DICTIONARY } from "@entities/shared/static/SWAGGER_DICTIONARY"

class SessionParamsDto {
  @ApiProperty({
    description: SWAGGER_DICTIONARY.auth.dto.sessionParams.sessionId,
    type: String,
    pattern: "^[a-fA-F0-9]{24}$",
  })
  @IsMongoId()
  sessionId: string
}

export { SessionParamsDto }
