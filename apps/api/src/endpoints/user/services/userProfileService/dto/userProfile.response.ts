import { ApiProperty } from "@nestjs/swagger"

import { SWAGGER_DICTIONARY } from "@endpoints/shared/static/SWAGGER_DICTIONARY"
import { REGEX } from "@shared/static/REGEX"

class UserProfileStatusCountsResponseDto {
  @ApiProperty({ type: "integer", minimum: 0 })
  planned: number

  @ApiProperty({ type: "integer", minimum: 0 })
  inProgress: number

  @ApiProperty({ type: "integer", minimum: 0 })
  onHold: number

  @ApiProperty({ type: "integer", minimum: 0 })
  completed: number

  @ApiProperty({ type: "integer", minimum: 0 })
  dropped: number
}

class UserProfileSummaryResponseDto {
  @ApiProperty({ type: UserProfileStatusCountsResponseDto })
  statusCounts: UserProfileStatusCountsResponseDto

  @ApiProperty({ type: "integer", minimum: 0 })
  ratingsCount: number

  @ApiProperty({ type: "integer", minimum: 0 })
  favoritesCount: number
}

class UserProfileResponseDto {
  @ApiProperty({ type: String, pattern: REGEX.MONGO_OBJECT_ID.source })
  id: string

  @ApiProperty({ example: SWAGGER_DICTIONARY.examples.username })
  username: string

  @ApiProperty({ example: SWAGGER_DICTIONARY.examples.displayUsername })
  displayName: string

  @ApiProperty({ oneOf: [{ type: "string" }, { type: "null" }] })
  avatarUrl: string | null

  @ApiProperty({
    type: String,
    format: "date-time",
    description: SWAGGER_DICTIONARY.user.profile.createdAt,
  })
  createdAt: string

  @ApiProperty({ type: UserProfileSummaryResponseDto })
  summary: UserProfileSummaryResponseDto
}

export { UserProfileResponseDto }
