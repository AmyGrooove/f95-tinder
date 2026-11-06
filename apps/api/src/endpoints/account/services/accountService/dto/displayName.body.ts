import { ApiProperty } from "@nestjs/swagger"
import { Transform } from "class-transformer"
import { IsNotEmpty, IsString, MaxLength } from "class-validator"

import { isString } from "@shared/functions/checks/isString"
import { SWAGGER_DICTIONARY } from "@endpoints/shared/static/SWAGGER_DICTIONARY"
import type { ITransformProps } from "@endpoints/shared/types/ITransformProps"

class DisplayNameBodyDto {
  @ApiProperty({
    description: SWAGGER_DICTIONARY.account.dto.displayNameBody.displayName,
    example: SWAGGER_DICTIONARY.examples.displayName,
    minLength: 1,
    maxLength: 40,
  })
  @Transform((props: ITransformProps) => {
    const { value } = props

    return isString(value) ? value.trim() : value
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  displayName: string
}

export { DisplayNameBodyDto }
