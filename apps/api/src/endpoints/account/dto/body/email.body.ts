import { ApiProperty } from "@nestjs/swagger"
import { Transform } from "class-transformer"
import {
  IsByteLength,
  IsEmail,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator"

import { isString } from "@shared/functions/checks/isString"
import { SWAGGER_DICTIONARY } from "@entities/shared/static/SWAGGER_DICTIONARY"

class EmailBodyDto {
  @ApiProperty({
    description: SWAGGER_DICTIONARY.account.dto.emailBody.email,
    maxLength: 254,
  })
  @Transform(({ value }: { value: unknown }) =>
    isString(value) ? value.trim().toLowerCase() : value,
  )
  @IsString()
  @IsEmail()
  @MaxLength(254)
  email: string

  @ApiProperty({
    description: SWAGGER_DICTIONARY.common.currentPassword,
    minLength: 8,
    maxLength: 72,
    format: "password",
  })
  @IsString()
  @MinLength(8)
  @IsByteLength(0, 72)
  currentPassword: string
}

export { EmailBodyDto }
