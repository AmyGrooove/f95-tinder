import { ApiProperty } from "@nestjs/swagger"
import { Transform } from "class-transformer"
import { IsNotEmpty, IsString } from "class-validator"

import { isString } from "@shared/functions/checks/isString"
import { SWAGGER_DICTIONARY } from "@entities/shared/static/SWAGGER_DICTIONARY"

class DisplayNameBodyDto {
  @ApiProperty({
    description: SWAGGER_DICTIONARY.account.dto.displayNameBody.displayName,
    example: SWAGGER_DICTIONARY.examples.displayName,
    minLength: 1,
  })
  @Transform(({ value }: { value: unknown }) =>
    isString(value) ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  displayName: string
}

export { DisplayNameBodyDto }
