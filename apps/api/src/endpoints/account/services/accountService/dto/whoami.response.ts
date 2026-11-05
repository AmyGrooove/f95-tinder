import { ApiProperty } from "@nestjs/swagger"

import { WhoamiSessionResponseDto } from "./whoamiSession.response"
import { WhoamiUserResponseDto } from "./whoamiUser.response"
import { SWAGGER_DICTIONARY } from "@entities/shared/static/SWAGGER_DICTIONARY"

class WhoamiResponseDto {
  @ApiProperty({
    description: SWAGGER_DICTIONARY.account.dto.whoamiResponse.user,
    type: WhoamiUserResponseDto,
  })
  user: WhoamiUserResponseDto

  @ApiProperty({
    description: SWAGGER_DICTIONARY.common.currentSession,
    type: WhoamiSessionResponseDto,
  })
  session: WhoamiSessionResponseDto
}

export { WhoamiResponseDto }
