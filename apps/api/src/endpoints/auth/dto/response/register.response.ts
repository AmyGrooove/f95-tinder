import { ApiProperty } from "@nestjs/swagger"

class RegisterResponseDto {
  @ApiProperty({
    description: "Автоматически сгенерированный логин",
    example: "quietfox042",
  })
  username: string

  @ApiProperty({
    description:
      "Секретный код для входа до первоначальной настройки аккаунта; необходимо сохранить",
    minLength: 32,
    maxLength: 32,
    pattern: "^[A-Za-z0-9_-]{32}$",
  })
  accessCode: string
}

export { RegisterResponseDto }
