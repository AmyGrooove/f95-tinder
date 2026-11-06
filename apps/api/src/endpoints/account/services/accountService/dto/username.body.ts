import { REGEX } from "@shared/static/REGEX"
import { ApiProperty } from "@nestjs/swagger"
import { Transform } from "class-transformer"
import { IsString, Matches, MaxLength } from "class-validator"

import { isString } from "@shared/functions/checks/isString"
import { SWAGGER_DICTIONARY } from "@endpoints/shared/static/SWAGGER_DICTIONARY"
import type { ITransformProps } from "@endpoints/shared/types/ITransformProps"

class UsernameBodyDto {
  @ApiProperty({
    description: SWAGGER_DICTIONARY.account.dto.usernameBody.username,
    example: "quietfox042",
    minLength: 1,
    maxLength: 32,
    pattern: REGEX.USERNAME.source,
  })
  @Transform((props: ITransformProps) => {
    const { value } = props

    return isString(value) ? value.trim().toLowerCase() : value
  })
  @IsString()
  @Matches(REGEX.USERNAME)
  @MaxLength(32)
  username: string
}

export { UsernameBodyDto }
