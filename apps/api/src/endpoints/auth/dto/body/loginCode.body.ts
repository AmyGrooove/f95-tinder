import { ApiProperty } from "@nestjs/swagger"
import { IsString, Matches } from "class-validator"

class LoginCodeBodyDto {
  @ApiProperty({
    description: "Секретный код, полученный при регистрации или перевыпуске",
    minLength: 32,
    maxLength: 32,
    pattern: "^[A-Za-z0-9_-]{32}$",
  })
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{32}$/)
  accessCode: string
}

export { LoginCodeBodyDto }
