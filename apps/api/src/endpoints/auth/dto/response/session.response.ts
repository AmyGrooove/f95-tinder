import { ApiProperty } from "@nestjs/swagger"

class SessionResponseDto {
  @ApiProperty({ description: "Идентификатор сессии" })
  id: string

  @ApiProperty({
    description: "User-Agent устройства",
    type: String,
    nullable: true,
  })
  userAgent: string | null

  @ApiProperty({ description: "Дата создания сессии", format: "date-time" })
  createdAt: string

  @ApiProperty({ description: "Срок действия сессии", format: "date-time" })
  expiresAt: string

  @ApiProperty({
    description: "Дата последнего обновления токенов",
    type: String,
    format: "date-time",
    nullable: true,
  })
  lastRefreshedAt: string | null

  @ApiProperty({ description: "Текущая сессия" })
  isCurrent: boolean
}

export { SessionResponseDto }
