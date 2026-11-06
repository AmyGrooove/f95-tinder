import { REGEX } from "@shared/static/REGEX"
import { ApiProperty } from "@nestjs/swagger"
import { SWAGGER_DICTIONARY } from "@endpoints/shared/static/SWAGGER_DICTIONARY"

class LoginCodeResponseDto {
  @ApiProperty({
    description: SWAGGER_DICTIONARY.auth.dto.loginCodeResponse.accessCode,
    minLength: 32,
    maxLength: 32,
    pattern: REGEX.ACCESS_CODE.source,
  })
  accessCode: string
}

export { LoginCodeResponseDto }
