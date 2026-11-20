import { ApiProperty } from "@nestjs/swagger"

import { LIBRARY_CONTINUE_STATUSES } from "@entities/userItem/static/LIBRARY_CONTINUE_STATUSES"
import { SWAGGER_DICTIONARY } from "@endpoints/shared/static/SWAGGER_DICTIONARY"

class LibraryContinueResponseDto {
  @ApiProperty({
    description: SWAGGER_DICTIONARY.account.dto.libraryContinueResponse.status,
    oneOf: [
      { type: "string", enum: [...LIBRARY_CONTINUE_STATUSES] },
      { type: "null" },
    ],
  })
  status: (typeof LIBRARY_CONTINUE_STATUSES)[number] | null
}

export { LibraryContinueResponseDto }
