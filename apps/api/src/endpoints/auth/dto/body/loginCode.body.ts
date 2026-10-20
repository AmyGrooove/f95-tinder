import { ApiProperty } from "@nestjs/swagger"
import { IsString, Matches } from "class-validator"
import { SWAGGER_DICTIONARY } from "@entities/shared/static/SWAGGER_DICTIONARY"

class LoginCodeBodyDto {
  @ApiProperty({
    description: SWAGGER_DICTIONARY.auth.dto.loginCodeBody.accessCode,
    minLength: 32,
    maxLength: 32,
    pattern: "^[A-Za-z0-9_-]{32}$",
  })
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{32}$/)
  accessCode: string
}

export { LoginCodeBodyDto }
