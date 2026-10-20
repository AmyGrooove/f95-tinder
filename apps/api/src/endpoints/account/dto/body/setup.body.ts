import { ApiProperty } from "@nestjs/swagger"
import { Transform } from "class-transformer"
import {
  IsByteLength,
  IsEmail,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator"

import { isString } from "@shared/functions/checks/isString"
import { SWAGGER_DICTIONARY } from "@entities/shared/static/SWAGGER_DICTIONARY"

class SetupBodyDto {
  @ApiProperty({
    description: SWAGGER_DICTIONARY.account.dto.setupBody.email,
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
    description: SWAGGER_DICTIONARY.common.newPassword,
    minLength: 8,
    maxLength: 72,
    format: "password",
  })
  @IsString()
  @MinLength(8)
  @IsByteLength(0, 72)
  password: string

  @ApiProperty({
    description: SWAGGER_DICTIONARY.account.dto.setupBody.accessCode,
    minLength: 32,
    maxLength: 32,
    pattern: "^[A-Za-z0-9_-]{32}$",
  })
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{32}$/)
  accessCode: string
}

export { SetupBodyDto }
