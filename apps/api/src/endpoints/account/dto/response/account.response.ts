import { ApiProperty } from "@nestjs/swagger"

import { WhoamiUserResponseDto } from "./whoamiUser.response"
import { SWAGGER_DICTIONARY } from "@entities/shared/static/SWAGGER_DICTIONARY"

class AccountResponseDto extends WhoamiUserResponseDto {
  @ApiProperty({
    description: SWAGGER_DICTIONARY.account.dto.accountResponse.email,
    type: String,
    nullable: true,
  })
  email: string | null

  @ApiProperty({
    description: SWAGGER_DICTIONARY.account.dto.accountResponse.isPasswordSet,
  })
  isPasswordSet: boolean

  @ApiProperty({
    description: SWAGGER_DICTIONARY.account.dto.accountResponse.isAccessCodeSet,
  })
  isAccessCodeSet: boolean

  @ApiProperty({
    description: SWAGGER_DICTIONARY.account.dto.accountResponse.createdAt,
    format: "date-time",
  })
  createdAt: string

  @ApiProperty({
    description: SWAGGER_DICTIONARY.account.dto.accountResponse.updatedAt,
    format: "date-time",
  })
  updatedAt: string
}

export { AccountResponseDto }
