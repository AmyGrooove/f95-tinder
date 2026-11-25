import { ApiProperty } from "@nestjs/swagger"

import { LIBRARY_CONTINUE_STATUSES } from "@entities/userItem/static/LIBRARY_CONTINUE_STATUSES"
import { SWAGGER_DICTIONARY } from "@endpoints/shared/static/SWAGGER_DICTIONARY"

const LIBRARY_CONTINUE_RESPONSE_STATUSES = [
  ...LIBRARY_CONTINUE_STATUSES,
  "none",
] as const

class LibraryContinueResponseDto {
  @ApiProperty({
    description: SWAGGER_DICTIONARY.account.dto.libraryContinueResponse.status,
    enum: LIBRARY_CONTINUE_RESPONSE_STATUSES,
  })
  status: (typeof LIBRARY_CONTINUE_RESPONSE_STATUSES)[number]
}

export { LibraryContinueResponseDto }
