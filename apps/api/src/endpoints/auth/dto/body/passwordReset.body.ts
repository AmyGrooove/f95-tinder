import { ApiProperty } from "@nestjs/swagger"
import { Transform } from "class-transformer"
import { IsEmail, IsString, MaxLength } from "class-validator"

import { isString } from "@shared/functions/checks/isString"
import { SWAGGER_DICTIONARY } from "@entities/shared/static/SWAGGER_DICTIONARY"

class PasswordResetBodyDto {
  @ApiProperty({
    description: SWAGGER_DICTIONARY.auth.dto.passwordResetBody.email,
    maxLength: 254,
  })
  @Transform(({ value }: { value: unknown }) =>
    isString(value) ? value.trim().toLowerCase() : value,
  )
  @IsString()
  @IsEmail()
  @MaxLength(254)
  email: string
}

export { PasswordResetBodyDto }
