import { ApiProperty } from "@nestjs/swagger"
import { Transform } from "class-transformer"
import { IsEmail, IsString, MaxLength } from "class-validator"

import { isString } from "@shared/functions/checks/isString"
import { SWAGGER_DICTIONARY } from "@endpoints/shared/static/SWAGGER_DICTIONARY"
import type { ITransformProps } from "@endpoints/shared/types/ITransformProps"

class PasswordResetBodyDto {
  @ApiProperty({
    description: SWAGGER_DICTIONARY.auth.dto.passwordResetBody.email,
    maxLength: 254,
  })
  @Transform((props: ITransformProps) => {
    const { value } = props

    return isString(value) ? value.trim().toLowerCase() : value
  })
  @IsString()
  @IsEmail()
  @MaxLength(254)
  email: string
}

export { PasswordResetBodyDto }
