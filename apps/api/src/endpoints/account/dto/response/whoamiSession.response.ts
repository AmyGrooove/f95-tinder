import { ApiProperty } from "@nestjs/swagger"
import { ECountry } from "@entities/shared/schemas/ECountry"
import { SWAGGER_DICTIONARY } from "@entities/shared/static/SWAGGER_DICTIONARY"

class WhoamiSessionResponseDto {
  @ApiProperty({
    description: SWAGGER_DICTIONARY.account.dto.whoamiSessionResponse.id,
  })
  id: string

  @ApiProperty({
    description: SWAGGER_DICTIONARY.common.sessionCountry,
    enum: ECountry,
    enumName: "ECountry",
  })
  country: ECountry

  @ApiProperty({
    description: SWAGGER_DICTIONARY.common.sessionExpiration,
    format: "date-time",
  })
  expiresAt: string
}

export { WhoamiSessionResponseDto }
