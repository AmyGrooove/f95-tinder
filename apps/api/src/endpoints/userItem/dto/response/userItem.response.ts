import { ApiProperty } from "@nestjs/swagger"

import { EUserItemStatus } from "@entities/userItem/schemas/EUserItemStatus"

import { AttemptResponseDto } from "./attempt.response"

class UserItemResponseDto {
  @ApiProperty({ type: String })
  id: string

  @ApiProperty({ type: String })
  itemId: string

  @ApiProperty({ enum: EUserItemStatus })
  status: EUserItemStatus

  @ApiProperty({ type: Number, nullable: true, minimum: 1, maximum: 10 })
  rating: number | null

  @ApiProperty({ type: Boolean })
  isFavorite: boolean

  @ApiProperty({ type: String, nullable: true })
  note: string | null

  @ApiProperty({ type: [AttemptResponseDto] })
  attempts: AttemptResponseDto[]

  @ApiProperty({ type: String, format: "date-time" })
  createdAt: string

  @ApiProperty({ type: String, format: "date-time" })
  updatedAt: string
}

export { UserItemResponseDto }
