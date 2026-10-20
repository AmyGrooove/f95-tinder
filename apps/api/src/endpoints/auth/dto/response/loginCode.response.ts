import { ApiProperty } from "@nestjs/swagger"
import { SWAGGER_DICTIONARY } from "@entities/shared/static/SWAGGER_DICTIONARY"

class LoginCodeResponseDto {
  @ApiProperty({
    description: SWAGGER_DICTIONARY.auth.dto.loginCodeResponse.accessCode,
    minLength: 32,
    maxLength: 32,
    pattern: "^[A-Za-z0-9_-]{32}$",
  })
  accessCode: string
}

export { LoginCodeResponseDto }
