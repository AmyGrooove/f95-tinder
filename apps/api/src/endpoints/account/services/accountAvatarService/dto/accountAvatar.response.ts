import { ApiProperty } from "@nestjs/swagger"

import { SWAGGER_DICTIONARY } from "@endpoints/shared/static/SWAGGER_DICTIONARY"

class AccountAvatarResponseDto {
  @ApiProperty({ description: SWAGGER_DICTIONARY.account.avatar.url })
  avatarUrl: string
}

export { AccountAvatarResponseDto }
