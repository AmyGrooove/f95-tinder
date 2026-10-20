import { ApiProperty } from "@nestjs/swagger"
import { SWAGGER_DICTIONARY } from "@entities/shared/static/SWAGGER_DICTIONARY"

class SessionResponseDto {
  @ApiProperty({ description: SWAGGER_DICTIONARY.auth.dto.sessionResponse.id })
  id: string

  @ApiProperty({
    description: SWAGGER_DICTIONARY.auth.dto.sessionResponse.userAgent,
    type: String,
    nullable: true,
  })
  userAgent: string | null

  @ApiProperty({
    description: SWAGGER_DICTIONARY.auth.dto.sessionResponse.createdAt,
    format: "date-time",
  })
  createdAt: string

  @ApiProperty({
    description: SWAGGER_DICTIONARY.common.sessionExpiration,
    format: "date-time",
  })
  expiresAt: string

  @ApiProperty({
    description: SWAGGER_DICTIONARY.auth.dto.sessionResponse.lastRefreshedAt,
    type: String,
    format: "date-time",
    nullable: true,
  })
  lastRefreshedAt: string | null

  @ApiProperty({ description: SWAGGER_DICTIONARY.common.currentSession })
  isCurrent: boolean
}

export { SessionResponseDto }
