import { ApiProperty } from "@nestjs/swagger"

import { WhoamiSessionResponseDto } from "./whoamiSession.response"
import { WhoamiUserResponseDto } from "./whoamiUser.response"

class WhoamiResponseDto {
  @ApiProperty({
    description: "Текущий пользователь",
    type: WhoamiUserResponseDto,
  })
  user: WhoamiUserResponseDto

  @ApiProperty({
    description: "Текущая сессия",
    type: WhoamiSessionResponseDto,
  })
  session: WhoamiSessionResponseDto
}

export { WhoamiResponseDto }
