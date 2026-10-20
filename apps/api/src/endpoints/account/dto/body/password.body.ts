import { ApiProperty } from "@nestjs/swagger"
import { IsByteLength, IsString, MinLength } from "class-validator"
import { SWAGGER_DICTIONARY } from "@entities/shared/static/SWAGGER_DICTIONARY"

class PasswordBodyDto {
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

export { PasswordBodyDto }
