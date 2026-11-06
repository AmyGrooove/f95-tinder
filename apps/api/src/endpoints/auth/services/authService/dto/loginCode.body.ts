import { REGEX } from "@shared/static/REGEX"
import { ApiProperty } from "@nestjs/swagger"
import { IsString, Matches } from "class-validator"
import { SWAGGER_DICTIONARY } from "@endpoints/shared/static/SWAGGER_DICTIONARY"

class LoginCodeBodyDto {
  @ApiProperty({
    description: SWAGGER_DICTIONARY.auth.dto.loginCodeBody.accessCode,
    minLength: 32,
    maxLength: 32,
    pattern: REGEX.ACCESS_CODE.source,
  })
  @IsString()
  @Matches(REGEX.ACCESS_CODE)
  accessCode: string
}

export { LoginCodeBodyDto }
