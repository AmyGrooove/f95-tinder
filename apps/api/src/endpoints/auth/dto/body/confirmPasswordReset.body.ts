import { ApiProperty } from "@nestjs/swagger"
import { IsByteLength, IsString, Matches, MinLength } from "class-validator"

import { PasswordResetBodyDto } from "./passwordReset.body"
import { SWAGGER_DICTIONARY } from "@entities/shared/static/SWAGGER_DICTIONARY"

class ConfirmPasswordResetBodyDto extends PasswordResetBodyDto {
  @ApiProperty({
    description: SWAGGER_DICTIONARY.auth.dto.confirmPasswordResetBody.code,
    minLength: 6,
    maxLength: 6,
    pattern: "^[0-9]{6}$",
  })
  @IsString()
  @Matches(/^[0-9]{6}$/)
  code: string

  @ApiProperty({
    description: SWAGGER_DICTIONARY.common.newPassword,
    minLength: 8,
    maxLength: 72,
    format: "password",
  })
  @IsString()
  @MinLength(8)
  @IsByteLength(0, 72)
  newPassword: string
}

export { ConfirmPasswordResetBodyDto }
