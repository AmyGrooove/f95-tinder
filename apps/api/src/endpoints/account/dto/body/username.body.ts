import { ApiProperty } from "@nestjs/swagger"
import { Transform } from "class-transformer"
import { IsString, Matches } from "class-validator"

import { USERNAME_REGEX } from "@entities/user/static/USERNAME_REGEX"
import { isString } from "@shared/functions/checks/isString"
import { SWAGGER_DICTIONARY } from "@entities/shared/static/SWAGGER_DICTIONARY"

class UsernameBodyDto {
  @ApiProperty({
    description: SWAGGER_DICTIONARY.account.dto.usernameBody.username,
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
}

export { UsernameBodyDto }
