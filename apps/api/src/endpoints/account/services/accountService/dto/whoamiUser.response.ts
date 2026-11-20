import { ApiProperty } from "@nestjs/swagger"

import { EUserRole } from "@entities/user/schemas/EUserRole"
import { SWAGGER_DICTIONARY } from "@endpoints/shared/static/SWAGGER_DICTIONARY"

class WhoamiUserResponseDto {
  @ApiProperty({
    description: SWAGGER_DICTIONARY.account.dto.whoamiUserResponse.id,
  })
  id: string

  @ApiProperty({
    description: SWAGGER_DICTIONARY.account.dto.whoamiUserResponse.username,
    example: SWAGGER_DICTIONARY.examples.username,
  })
  username: string

  @ApiProperty({
    description: SWAGGER_DICTIONARY.account.dto.whoamiUserResponse.displayName,
    example: SWAGGER_DICTIONARY.examples.displayUsername,
  })
  displayName: string

  @ApiProperty({
    description: SWAGGER_DICTIONARY.account.dto.whoamiUserResponse.avatarUrl,
    type: String,
    nullable: true,
  })
  avatarUrl: string | null

  @ApiProperty({
    description: SWAGGER_DICTIONARY.account.dto.whoamiUserResponse.email,
    type: String,
    nullable: true,
    format: "email",
  })
  email: string | null

  @ApiProperty({
    description:
      SWAGGER_DICTIONARY.account.dto.whoamiUserResponse.isPasswordSet,
  })
  isPasswordSet: boolean

  @ApiProperty({
    description:
      SWAGGER_DICTIONARY.account.dto.whoamiUserResponse.isAccessCodeEnabled,
  })
  isAccessCodeEnabled: boolean

  @ApiProperty({
    description: SWAGGER_DICTIONARY.account.dto.whoamiUserResponse.role,
    enum: EUserRole,
  })
  role: EUserRole
}

export { WhoamiUserResponseDto }
