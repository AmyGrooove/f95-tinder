import { REGEX } from "@shared/static/REGEX"
import { ApiProperty } from "@nestjs/swagger"
import { SWAGGER_DICTIONARY } from "@endpoints/shared/static/SWAGGER_DICTIONARY"

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
    pattern: REGEX.ACCESS_CODE.source,
  })
  accessCode: string
}

export { RegisterResponseDto }
