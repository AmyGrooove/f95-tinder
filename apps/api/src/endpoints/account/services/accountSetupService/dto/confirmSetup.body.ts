import { REGEX } from "@shared/static/REGEX"
import { ApiProperty } from "@nestjs/swagger"
import { IsString, Matches } from "class-validator"
import { SWAGGER_DICTIONARY } from "@endpoints/shared/static/SWAGGER_DICTIONARY"

class ConfirmSetupBodyDto {
  @ApiProperty({
    description: SWAGGER_DICTIONARY.account.dto.confirmSetupBody.code,
    minLength: 6,
    maxLength: 6,
    pattern: REGEX.CONFIRMATION_CODE.source,
  })
  @IsString()
  @Matches(REGEX.CONFIRMATION_CODE)
  code: string
}

export { ConfirmSetupBodyDto }
