import { ApiProperty } from "@nestjs/swagger"
import { Transform } from "class-transformer"
import { IsByteLength, IsString, Matches, MinLength } from "class-validator"

import { USERNAME_REGEX } from "@entities/user/static/USERNAME_REGEX"
import { isString } from "@shared/functions/checks/isString"
import { SWAGGER_DICTIONARY } from "@entities/shared/static/SWAGGER_DICTIONARY"

class LoginBodyDto {
  @ApiProperty({
    description: SWAGGER_DICTIONARY.auth.dto.loginBody.username,
    example: "quietfox042",
    minLength: 1,
    pattern: USERNAME_REGEX.source,
  })
  @Transform(({ value }: { value: unknown }) =>
    isString(value) ? value.trim().toLowerCase() : value,
  )
  @IsString()
  @Matches(USERNAME_REGEX)
  username: string

  @ApiProperty({
    description: SWAGGER_DICTIONARY.auth.dto.loginBody.password,
    minLength: 8,
    maxLength: 72,
    format: "password",
  })
  @IsString()
  @MinLength(8)
  @IsByteLength(0, 72)
  password: string
}

export { LoginBodyDto }
