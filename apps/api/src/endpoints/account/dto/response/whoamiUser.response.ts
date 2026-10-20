import { ApiProperty } from "@nestjs/swagger"

import { EUserRole } from "@entities/user/schemas/EUserRole"
import { SWAGGER_DICTIONARY } from "@entities/shared/static/SWAGGER_DICTIONARY"

class WhoamiUserResponseDto {
  @ApiProperty({
    description: SWAGGER_DICTIONARY.account.dto.whoamiUserResponse.id,
  })
  id: string

  @ApiProperty({
    description: SWAGGER_DICTIONARY.account.dto.whoamiUserResponse.username,
    example: "quietfox042",
  })
  username: string

  @ApiProperty({
    description: SWAGGER_DICTIONARY.account.dto.whoamiUserResponse.displayName,
    example: "quietFox042",
  })
  displayName: string

  @ApiProperty({
    description: SWAGGER_DICTIONARY.account.dto.whoamiUserResponse.avatarUrl,
    type: String,
    nullable: true,
  })
  avatarUrl: string | null

  @ApiProperty({
    description: SWAGGER_DICTIONARY.account.dto.whoamiUserResponse.role,
    enum: EUserRole,
  })
  role: EUserRole
}

export { WhoamiUserResponseDto }
