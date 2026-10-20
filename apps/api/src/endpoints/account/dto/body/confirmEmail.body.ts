import { ApiProperty } from "@nestjs/swagger"
import { IsString, Matches } from "class-validator"
import { SWAGGER_DICTIONARY } from "@entities/shared/static/SWAGGER_DICTIONARY"

class ConfirmEmailBodyDto {
  @ApiProperty({
    description: SWAGGER_DICTIONARY.account.dto.confirmEmailBody.code,
    minLength: 6,
    maxLength: 6,
    pattern: "^[0-9]{6}$",
  })
  @IsString()
  @Matches(/^[0-9]{6}$/)
  code: string
}

export { ConfirmEmailBodyDto }
