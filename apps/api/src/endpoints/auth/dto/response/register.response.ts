import { ApiProperty } from "@nestjs/swagger"
import { SWAGGER_DICTIONARY } from "@entities/shared/static/SWAGGER_DICTIONARY"

class RegisterResponseDto {
  @ApiProperty({
    description: SWAGGER_DICTIONARY.auth.dto.registerResponse.username,
    example: "quietfox042",
  })
  username: string

  @ApiProperty({
    description: SWAGGER_DICTIONARY.auth.dto.registerResponse.accessCode,
    minLength: 32,
    maxLength: 32,
    pattern: "^[A-Za-z0-9_-]{32}$",
  })
  accessCode: string
}

export { RegisterResponseDto }
