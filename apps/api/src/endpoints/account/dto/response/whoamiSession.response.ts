import { ApiProperty } from "@nestjs/swagger"

class WhoamiSessionResponseDto {
  @ApiProperty({ description: "Идентификатор текущей сессии" })
  id: string

  @ApiProperty({ description: "Срок действия сессии", format: "date-time" })
  expiresAt: string
}

export { WhoamiSessionResponseDto }
